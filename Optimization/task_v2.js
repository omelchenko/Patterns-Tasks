'use strict';

// Tasks for rewriting:
//   - Topic: SoC, SRP, code characteristics, V8
//   - Apply optimizations of computing resources: processor, memory
//   - Minimize cognitive complexity
//   - Respect SRP and SoC
//   - Improve readability (understanding), reliability
//   - Optimize for maintainability, reusability, flexibility
//   - Make code testable
//   - Implement simple unittests without frameworks
// Additional tasks:
//   - Try to implement in multiple paradigms: OOP, FP, procedural, mixed
//   - Prepare load testing and trace V8 deopts

const data = `city,population,area,density,country
  Shanghai,24256800,6340,3826,China
  Delhi,16787941,1484,11313,India
  Lagos,16060303,1171,13712,Nigeria
  Istanbul,14160467,5461,2593,Turkey
  Tokyo,13513734,2191,6168,Japan
  Sao Paulo,12038175,1521,7914,Brazil
  Mexico City,8874724,1486,5974,Mexico
  London,8673713,1572,5431,United Kingdom
  New York City,8537673,784,10892,United States
  Bangkok,8280925,1569,5279,Thailand`;

const DATA_SCHEMA = {
    population: Number,
    area: Number,
    density: Number,
};

const FORMAT_OPTIONS = {
    columns: [
        { width: 18, align: 'left' },
        { width: 10 },
        { width: 8 },
        { width: 8 },
        { width: 18 },
        { width: 6 },
    ],
};

class ParserCsv {
    #columns;
    #lines;
    #cellSep;

    constructor(csv, { lineSep = '\n', cellSep = ',' } = {}) {
        this.#cellSep = cellSep;
        const [headerLine, ...lines] = csv.split(lineSep);
        this.#columns = headerLine.split(cellSep);
        this.#lines = lines;
    }

    // static rowToJSON = (values, columns) =>
    //     Object.fromEntries(columns.map((column, index) => [column, values[index]]));

    static cellWithTypes = (types) => (value, column) => {
        const cast = types[column];
        return cast ? cast(value) : value;
    };

    getColumns() {
        return this.#columns;
    }

    toDatasetArray({ cellTransformers = [], rowTransformers = [] } = {}) {
        const cellPipeline = [].concat(cellTransformers);
        const rowPipeline = [].concat(rowTransformers);

        return this.#lines.map(rawLine => {
            const values = rawLine.split(this.#cellSep).map((value, index) =>
                cellPipeline.reduce(
                    (result, strategy) => strategy(result, this.#columns[index]),
                    value
                )
            );
            return rowPipeline.reduce(
                (result, strategy) => strategy(result, this.#columns),
                values
            );
        });
    }
}

class TableData {
    #columns;
    #rows;

    constructor(columns, rows) {
        this.#columns = [...columns];
        this.#rows = rows.map(row => [...row]);
    }

    #indexOf(column) {
        return this.#columns.indexOf(column);
    }

    maxBy(column) {
        const index = this.#indexOf(column);
        return Math.max(...this.#rows.map(row => Number(row[index])));
    }

    addColumn(name, compute) {
        const columns = [...this.#columns, name];
        const rows = this.#rows.map(row => [...row, compute(row, this.#columns, this.#rows)]);
        return new TableData(columns, rows);
    }

    sortBy(column, order = 'desc') {
        const colIndex = this.#indexOf(column);
        const compare = order === 'desc'
            ? (a, b) => b[colIndex] - a[colIndex]
            : (a, b) => a[colIndex] - b[colIndex];
        const rows = [...this.#rows].sort(compare);
        return new TableData(this.#columns, rows);
    }

    getColumns() {
        return [...this.#columns];
    }

    getRows() {
        return this.#rows.map(row => [...row]);
    }
}

class RendererTable {
    #columns;
    #output;

    constructor({ columns = [], output = console.log } = {}) {
        this.#columns = columns;
        this.#output = output;
    }

    #formatCell(cell, index) {
        const { width, align = 'right' } = this.#columns[index] ?? {};
        return align === 'left'
            ? String(cell).padEnd(width)
            : String(cell).padStart(width);
    }

    #formatRow(row) {
        return row.map((cell, i) => this.#formatCell(cell, i)).join('');
    }

    render(rows) {
        for (const row of rows) this.#output(this.#formatRow(row));
    }
}

class App {
    #data;
    #inputFormat;
    #outputFormat;
    #parsers;
    #renderers;
    #dataSchema;
    #formatOptions;

    constructor({ data, inputFormat, outputFormat, parsers, renderers, dataSchema = {}, formatOptions = {} }) {
        this.#data = data;
        this.#inputFormat = inputFormat;
        this.#outputFormat = outputFormat;
        this.#parsers = parsers;
        this.#renderers = renderers;
        this.#dataSchema = dataSchema;
        this.#formatOptions = formatOptions;
    }

    run() {
        const Parser = this.#parsers.get(this.#inputFormat);
        if (!Parser) throw new Error(`No parser registered for input format: "${this.#inputFormat}"`);

        const Renderer = this.#renderers.get(this.#outputFormat);
        if (!Renderer) throw new Error(`No renderer registered for output format: "${this.#outputFormat}"`);

        const parser = new Parser(this.#data);
        const renderer = new Renderer(this.#formatOptions);

        const columns = parser.getColumns();
        const rows = parser.toDatasetArray({
            cellTransformers: [
                ParserCsv.cellWithTypes(this.#dataSchema),
            ],
        });

        const table = new TableData(columns, rows);
        const maxDensity = table.maxBy('density');

        const result = table
            .addColumn('percent', (row, columns) => {
                const index = columns.indexOf('density');
                return Math.round(row[index] * 100 / maxDensity);
            })
            .sortBy('percent');

        renderer.render(result.getRows());
    }
}

const parsers = new Map([
    ['csv', ParserCsv],
]);

const renderers = new Map([
    ['table', RendererTable],
]);

new App({
    data,
    inputFormat: 'csv',
    outputFormat: 'table',
    parsers,
    renderers,
    dataSchema: DATA_SCHEMA,
    formatOptions: FORMAT_OPTIONS,
}).run();
