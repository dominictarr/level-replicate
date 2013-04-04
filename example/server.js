
var levelup = require('levelup')
var SubLevel = require('level-sublevel')
var pull      = require('pull-stream')
var toPull    = require('stream-to-pull-stream')

var http = require('http')

module.exports = function (db, master) {
  
  function key(req) {
    return req.url.substring(1).split('/').join('\x00')
  }

  return http.createServer(function (req, res) {
    if(/PUT|POST/.test(req.method)) {
      console.log('PUT')
      toPull(
        req
        .on('data', console.log)
        .on('end', function () {
          console.log('end!!!!')
        })
      ).pipe(pull.collect(function (err, ary) {
        var value = ary.join('')
        console.log('PUT', key(req), value, ary)
        db.put(key(req), value, function (err) {
          console.log('PUT', key(req), value, ary)
          if(err) res.end(JSON.stringify({error: err.code}))
          else    res.end()
        })
      }))
    }
    else if(master && /\/_replicate/.test(req.path))
      req.pipe(master.createStream()).pipe(res)
    else {
      db.get(key(req), function (err, value) {
        if(err) res.end(JSON.stringify({error: err.code}))
        else    res.end(value)
      })
    }

    req.resume()
  })

}

