'use strict'

const assert = require('assert')

const util = require('../libs/util')
const {Expr} = require('../libs/expr')
const {Summarize} = require('../libs/summarize')
const {Stage} = require('../libs/stage')
const {Pipeline} = require('../libs/pipeline')
const {Program} = require('../libs/program')

const checkObject = (restoreFunc, fixture, expected, message) => {
  const actual = restoreFunc(fixture)
  assert.deepEqual(actual, expected, message)
}

describe('persistence infrastructure', () => {
  it('handles basic types', (done) => {
    const allChecks = [
      ['number', 55],
      ['empty string', ''],
      ['non-empty string', 'something'],
      ['empty array', []],
      ['non-empty array without @kind', ['left', 'right']]
    ]
    for (const [name, value] of allChecks) {
      assert.deepEqual(value, Expr.fromJSON(value), name)
    }
    done()
  })
})

describe('expression persistence', () => {
  it('requires a known kind of expression', (done) => {
    assert.throws(() => Expr.fromJSON(['@whoops', 'whoops']),
                  Error,
                  `Requires known kind of expression`)
    done()
  })
  
  it('restores a constant', (done) => {
    checkObject(Expr.fromJSON,
                [Expr.NULLARY, 'constant', 123],
                new Expr.constant(123),
                `Constant`)
    done()
  })

  it('persists constants', (done) => {
    assert.deepEqual([Expr.NULLARY, 'constant', 'orange'],
                     (new Expr.constant('orange')).toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists column getters', (done) => {
    assert.deepEqual([Expr.NULLARY, 'column', 'orange'],
                     (new Expr.column('orange')).toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists unary expressions', (done) => {
    const expr = new Expr.not(new Expr.constant(false))
    assert.deepEqual([Expr.NEGATE, 'not', [Expr.NULLARY, 'constant', false]],
                     expr.toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists binary expressions', (done) => {
    const expr = new Expr.power(new Expr.constant(1), new Expr.constant(2))
    assert.deepEqual([Expr.ARITHMETIC, 'power',
                      [Expr.NULLARY, 'constant', 1],
                      [Expr.NULLARY, 'constant', 2]],
                     expr.toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists ternary expressions', (done) => {
    const expr = new Expr.ifElse(new Expr.constant(true),
                                 new Expr.constant('a'),
                                 new Expr.constant('b'))
    const expected = [Expr.TERNARY, 'ifElse',
                      [Expr.NULLARY, 'constant', true],
                      [Expr.NULLARY, 'constant', 'a'],
                      [Expr.NULLARY, 'constant', 'b']]
    assert.deepEqual(expected, expr.toJSON(),
                     `Mis-match`)
    done()
  })

  it('restores a column', (done) => {
    checkObject(Expr.fromJSON,
                [Expr.NULLARY, 'column', 'blue'],
                new Expr.column('blue'),
                `Column`)
    done()
  })

  it('restores unary operations', (done) => {
    const child = new Expr.constant(123)
    const childJSON = child.toJSON()
    const allChecks = [
      ['negate', Expr.negate],
      ['not', Expr.not]
    ]
    for (const [name, func] of allChecks) {
      checkObject(Expr.fromJSON,
                  [Expr.NEGATE, name, childJSON],
                  new func(child),
                 `Failed to restore unary "${name}"`)
    }
    done()
  })

  it('restores binary operations', (done) => {
    const child = new Expr.constant(123)
    const childJSON = child.toJSON()
    const allChecks = [
      ['add', Expr.add],
      ['and', Expr.and],
      ['divide', Expr.divide],
      ['equal', Expr.equal],
      ['greater', Expr.greater],
      ['greaterEqual', Expr.greaterEqual],
      ['less', Expr.less],
      ['lessEqual', Expr.lessEqual],
      ['multiply', Expr.multiply],
      ['notEqual', Expr.notEqual],
      ['or', Expr.or],
      ['power', Expr.power],
      ['remainder', Expr.remainder],
      ['subtract', Expr.subtract]
    ]
    for (const [name, func] of allChecks) {
      checkObject(Expr.fromJSON,
                  [Expr.ARITHMETIC, name, childJSON, childJSON],
                  new func(child, child),
                  `Failed to restore binary "${name}"`)
    }
    done()
  })

  it('restores ternary operations', (done) => {
    const child = new Expr.constant(123)
    const childJSON = child.toJSON()
    const allChecks = [
      ['ifElse', Expr.ifElse]
    ]
    for (const [name, func] of allChecks) {
      checkObject(Expr.fromJSON,
                  [Expr.TERNARY, name, childJSON, childJSON, childJSON],
                  new func(child, child, child),
                  `Failed to restore ternary "${name}"`)
    }
    done()
  })

  it('restores type-checking operations', (done) => {
    const child = new Expr.constant(123)
    const childJSON = child.toJSON()
    const allChecks = [
      ['isBool', Expr.isBool],
      ['isDatetime', Expr.isDatetime],
      ['isMissing', Expr.isMissing],
      ['isNumber', Expr.isNumber],
      ['isString', Expr.isString]
    ]
    for (const [name, func] of allChecks) {
      checkObject(Expr.fromJSON,
                  [Expr.TYPECHECK, name, childJSON],
                  new func(child),
                  `Failed to restore type-checking expression ${name}`)
    }
    done()
  })

  it('restores conversion operations', (done) => {
    const child = new Expr.constant(123)
    const childJSON = child.toJSON()
    const allChecks = [
      ['toBool', Expr.toBool],
      ['toDatetime', Expr.toDatetime],
      ['toNumber', Expr.toNumber],
      ['toString', Expr.toString]
    ]
    for (const [name, func] of allChecks) {
      checkObject(Expr.fromJSON,
                  [Expr.CONVERT, name, childJSON],
                  new func(child),
                  `Failed to restore conversion expression ${name}`)
    }
    done()
  })

  it('restores datetime operations', (done) => {
    const concert = new Date(1983, 11, 2, 7, 55, 19, 0)
    const child = new Expr.constant(concert)
    const childJSON = child.toJSON()
    const allChecks = [
      ['toYear', Expr.toYear],
      ['toMonth', Expr.toMonth],
      ['toDay', Expr.toDay],
      ['toWeekday', Expr.toWeekday],
      ['toHours', Expr.toHours],
      ['toMinutes', Expr.toMinutes],
      ['toSeconds', Expr.toSeconds]
    ]
    for (const [name, func] of allChecks) {
      checkObject(Expr.fromJSON,
                  [Expr.DATETIME, name, childJSON],
                  new func(child),
                  `Failed to restore datetime operation ${name}`)
    }
    done()
  })
})

describe('stage persistence', () => {
  it('requires a known kind of stage', (done) => {
    assert.throws(() => Stage.fromJSON(['@whoops', 'whoops']),
                  Error,
                  `Requires known kind of stage`)
    done()
  })

  it('persists drop', (done) => {
    assert.deepEqual([Stage.TRANSFORM, 'drop', ['left', 'right']],
                     (new Stage.drop(['left', 'right'])).toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists filter', (done) => {
    const stage = new Stage.filter(new Expr.column('keep'))
    assert.deepEqual([Stage.TRANSFORM, 'filter', [Expr.NULLARY, 'column', 'keep']],
                     stage.toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists groupBy', (done) => {
    const stage = new Stage.groupBy(['pink', 'yellow'])
    assert.deepEqual([Stage.TRANSFORM, 'groupBy', ['pink', 'yellow']],
                     stage.toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists join', (done) => {
    const stage = new Stage.join('west', 'up', 'east', 'down')
    assert.deepEqual([Stage.TRANSFORM, 'join', 'west', 'up', 'east', 'down'],
                     stage.toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists mutate', (done) => {
    const stage = new Stage.mutate('fresh', new Expr.constant(true))
    assert.deepEqual([Stage.TRANSFORM, 'mutate', 'fresh', [Expr.NULLARY, 'constant', true]],
                     stage.toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists select', (done) => {
    const stage = new Stage.select(['pink', 'orange'])
    assert.deepEqual([Stage.TRANSFORM, 'select', ['pink', 'orange']],
                     stage.toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists summarize', (done) => {
    const stage = new Stage.summarize('maximum', 'red')
    assert.deepEqual([Stage.TRANSFORM, 'summarize', 'maximum', 'red'],
                     stage.toJSON(),
                     `Mis-match`)
    done()
  })

  it('persists ungroup', (done) => {
    const stage = new Stage.ungroup()
    assert.deepEqual([Stage.TRANSFORM, 'ungroup'],
                     stage.toJSON(),
                     `Mis-match`)
    done()
  })

  it('restores drop from JSON', (done) => {
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'drop', ['left', 'right']],
                new Stage.drop(['left', 'right']),
                `drop`)
    done()
  })

  it('restores filter from JSON', (done) => {
    const child = new Expr.constant(true)
    const childJSON = child.toJSON()
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'filter', childJSON],
                new Stage.filter(child),
                `filter`)
    done()
  })

  it('restores groupBy from JSON', (done) => {
    const columns = ['left', 'right']
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'groupBy', columns],
                new Stage.groupBy(columns),
                `groupBy`)
    done()
  })

  it('restores join from JSON', (done) => {
    const leftName = 'before',
          leftCol = 'red',
          rightName = 'after',
          rightCol = 'blue'
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'join', leftName, leftCol, rightName, rightCol],
                new Stage.join(leftName, leftCol, rightName, rightCol),
                `join`)
    done()
  })

  it('restores mutate from JSON', (done) => {
    const newName = 'finished'
    const child = new Expr.constant(true)
    const childJSON = child.toJSON()
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'mutate', newName, childJSON],
                new Stage.mutate(newName, child),
                `mutate`)
    done()
  })

  it('restores notify from JSON', (done) => {
    const label = 'signal'
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'notify', 'signal'],
                new Stage.notify(label),
                `notify`)
    done()
  })

  it('restores read from JSON', (done) => {
    const path = '/to/file'
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'read', path],
                new Stage.read(path),
                `notify`)
    done()
  })

  it('restores select from JSON', (done) => {
    const columns = ['left', 'right']
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'select', columns],
                new Stage.select(columns),
                `select`)
    done()
  })

  it('restores sort from JSON', (done) => {
    const columns = ['left', 'right']
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'sort', columns],
                new Stage.sort(columns),
                `sort`)
    done()
  })

  it('restores summarize from JSON', (done) => {
    const stage = new Stage.summarize('mean', 'red')
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'summarize', 'mean', 'red'],
                stage,
                `summarize`)
    done()
  })

  it('restores ungroup from JSON', (done) => {
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'ungroup'],
                new Stage.ungroup(),
                `ungroup`)
    done()
  })

  it('restores unique from JSON', (done) => {
    const columns = ['left', 'right']
    checkObject(Stage.fromJSON,
                [Stage.TRANSFORM, 'unique', columns],
                new Stage.unique(columns),
                `unique`)
    done()
  })
})

describe('plot persistence', () => {
  it('restores bar from JSON', (done) => {
    const x_axis = 'age', y_axis = 'height'
    checkObject(Stage.fromJSON,
                [Stage.PLOT, 'bar', x_axis, y_axis],
                new Stage.bar(x_axis, y_axis),
                `bar`)
    done()
  })

  it('restores box from JSON', (done) => {
    const x_axis = 'age', y_axis = 'height'
    checkObject(Stage.fromJSON,
                [Stage.PLOT, 'box', x_axis, y_axis],
                new Stage.box(x_axis, y_axis),
                `box`)
    done()
  })

  it('restores dot from JSON', (done) => {
    const x_axis = 'age'
    checkObject(Stage.fromJSON,
                [Stage.PLOT, 'dot', x_axis],
                new Stage.dot(x_axis),
                `dot`)
    done()
  })

  it('restores histogram from JSON', (done) => {
    const column = 'age'
    const bins = 17
    checkObject(Stage.fromJSON,
                [Stage.PLOT, 'histogram', column, bins],
                new Stage.histogram(column, bins),
                `histogram`)
    done()
  })

  it('restores scatter from JSON', (done) => {
    const x_axis = 'age', y_axis = 'height', color = 'vermilion'
    checkObject(Stage.fromJSON,
                [Stage.PLOT, 'scatter', x_axis, y_axis, color],
                new Stage.scatter(x_axis, y_axis, color),
                `scatter`)
    done()
  })
})

describe('statistics persistence', () => {
  it('restores ANOVA from JSON', (done) => {
    const significance = 0.03, groupName = 'red', valueName = 'blue'
    checkObject(Stage.fromJSON,
                [Stage.STATS, 'ANOVA', significance, groupName, valueName],
                new Stage.ANOVA(significance, groupName, valueName),
                `ANOVA`)
    done()
  })

  it('restores Kolmogorov-Smirnov from JSON', (done) => {
    const mean = 0.1, stdDev = 0.3, significance = 0.03, colName = 'red'
    checkObject(Stage.fromJSON,
                [Stage.STATS, 'KolmogorovSmirnov', mean, stdDev, significance, colName],
                new Stage.KolmogorovSmirnov(mean, stdDev, significance, colName),
                `Kolmogorov-Smirnov`)
    done()
  })

  it('restores Kruskal-Wallis from JSON', (done) => {
    const significance = 0.03, groupName = 'red', valueName = 'blue'
    checkObject(Stage.fromJSON,
                [Stage.STATS, 'KruskalWallis', significance, groupName, valueName],
                new Stage.KruskalWallis(significance, groupName, valueName),
                `Kruskal-Wallis`)
    done()
  })

  it('restores one-sample t test from JSON', (done) => {
    const mean = 0.1, significance = 0.03, colName = 'red'
    checkObject(Stage.fromJSON,
                [Stage.STATS, 'TTestOneSample', mean, significance, colName],
                new Stage.TTestOneSample(mean, significance, colName),
                `one-sample t test`)
    done()
  })

  it('restores paired two-sided t test from JSON', (done) => {
    const significance = 0.03, leftCol = 'green', rightCol = 'blue'
    checkObject(Stage.fromJSON,
                [Stage.STATS, 'TTestPaired', significance, leftCol, rightCol],
                new Stage.TTestPaired(significance, leftCol, rightCol),
                `paired t test`)
    done()
  })

  it('restores one-sample z test from JSON', (done) => {
    const mean = 0.1, stdDev = 0.04, significance = 0.03, colName = 'red'
    checkObject(Stage.fromJSON,
                [Stage.STATS, 'ZTestOneSample', mean, stdDev, significance, colName],
                new Stage.ZTestOneSample(mean, stdDev, significance, colName),
                `one-sample z test`)
    done()
  })
})

describe('pipeline persistence', () => {
  it('turns a single pipeline into JSON', (done) => {
    const path = '/path/to/file'
    const pipeline = new Pipeline('pipe', new Stage.read(path), new Stage.sort(['left'], true))
    const actual = pipeline.toJSON()
    const expected = [Pipeline.KIND, 'pipe',
                      [Stage.TRANSFORM, 'read', path],
                      [Stage.TRANSFORM, 'sort', ['left'], true]]
    assert.deepEqual(actual, expected,
                     `Wrong JSON`)
    done()
  })

  it('turns JSON into a single pipeline', (done) => {
    const fixture = [Pipeline.KIND, 'name',
                     [Stage.TRANSFORM, 'read', 'colors.csv'],
                     [Stage.TRANSFORM, 'sort', ['left', 'right'], false]]
    const actual = Pipeline.fromJSON(fixture)
    const expected = new Pipeline('name',
                                  new Stage.read('colors.csv'),
                                  new Stage.sort(['left', 'right'], false))
    assert.deepEqual(actual, expected,
                     `Wrong result from reading pipeline`)
    done()
  })
})

describe('program persistence', () => {
  it('turns a multi-pipeline program into JSON', (done) => {
    const program = new Program(
      new Pipeline('first', new Stage.read('/path/to/first')),
      new Pipeline('second', new Stage.read('/path/to/second'), new Stage.unique(['left'])),
      new Pipeline('third', new Stage.read('/path/to/third'), new Stage.notify('signal'))
    )
    const actual = program.toJSON()
    const expected = [
      Program.KIND,
      [Pipeline.KIND, 'first',
       [Stage.TRANSFORM, 'read', '/path/to/first']],
      [Pipeline.KIND, 'second',
       [Stage.TRANSFORM, 'read', '/path/to/second'],
       [Stage.TRANSFORM, 'unique', ['left']]],
      [Pipeline.KIND, 'third',
       [Stage.TRANSFORM, 'read', '/path/to/third'],
       [Stage.TRANSFORM, 'notify', 'signal']]
    ]
    assert.deepEqual(actual, expected,
                     `Wrong result for persisting program`)
    done()
  })

  it('turns JSON into a multi-pipeline program', (done) => {
    const fixture = [
      Program.KIND,
      [Pipeline.KIND, 'alpha',
       [Stage.TRANSFORM, 'read', 'colors.csv']],
      [Pipeline.KIND, 'beta',
       [Stage.TRANSFORM, 'read', 'colors.csv'],
       [Stage.TRANSFORM, 'unique', ['red']]],
      [Pipeline.KIND, 'gamma',
       [Stage.TRANSFORM, 'read', 'colors.csv'],
       [Stage.TRANSFORM, 'notify', 'signal']]
    ]
    const program = Program.fromJSON(fixture)
    const roundtrip = program.toJSON()
    assert.deepEqual(fixture, roundtrip,
                     `Wrong result from restoring program`)
    done()
  })
})
