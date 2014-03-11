var levelup = require('level-test')()
  , replicate = require('../')
  , sublevel = require('level-sublevel')
  , test = require('tape')
  , opts = {keyEncoding: 'utf8', valueEncoding: 'json'}

function fill(prefix) {
  // reuse this test
  test('replicates with key prefix: '+prefix, function (t) {
    var db1 = sublevel(levelup('char-keys-db1'+prefix, opts))
      , m1 = replicate(db1, 'master', 'M1')

    var db2 = sublevel(levelup('char-keys-db2'+prefix, opts))
      , m2 = replicate(db2, 'master', 'M2')

    // add one un-prefixed document
    db1.put(('' + Math.random()), {foo: 'bar'}, function (err) {
      if (err) console.log('err', err);
      // add one prefixed document (if a prefix was provided)
      db1.put(('' + prefix + Math.random()), {bar: 'baz'}, function (err) {
        if (err) console.log('err', err);

        // replicate databases
        m1s = m1.createStream({tail: true})
        m1s.pipe(m2.createStream({tail: true})).pipe(m1s)

        setTimeout(function () {
          // collect result
          var db1result = ''
          var db2result = ''

          db1.createReadStream().on('data', function(data){
            db1result += JSON.stringify(data)
          })
          db2.createReadStream().on('data', function(data){
            db2result += JSON.stringify(data)
          })

          setTimeout(function () {
            t.ok(db1result, 'db1 has content')
            t.equal(db1result, db2result, 'contents matches')
            t.end()
          }, 500)
        }, 500)
      });
    });
  })
}

fill('')
fill('a-prefix')
