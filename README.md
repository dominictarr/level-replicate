# level-replicate [![build status](https://secure.travis-ci.org/dominictarr/level-replicate.png)](http://travis-ci.org/dominictarr/level-replicate)

master-master replication with levelup.

Implements scuttlebutt style handshake and then syncs data, then replicates real time changes.

## Example

Replicate from a between two processes.
One process starts a server, and another connects.

``` js
//master1.js
var level   = require('level')
var SubLevel  = require('level-sublevel')
var net       = require('net')
var Replicate = require('level-replicate')

//setup the database.
var db = SubLevel(level('/tmp/example-master'))

//install Master plugin!
var master = Replicate(db, 'master', "MASTER-1")

//create a server, and stream data to who ever connects.
net.createServer(function (stream) {
  stream.pipe(master.createStream({tail: true})).pipe(stream)
}).listen(9999, function () {
  console.log('master db listening on 9999')
})
```

Then, the code for the client!

``` js
//master2.js
var levelup   = require('level')
var SubLevel  = require('level-sublevel')
var net       = require('net')
var Replicate = require('level-replicate')

var db = SubLevel(level('/tmp/example-slave'))
var master = Replicate(db, 'master', "MASTER-2")

var stream = net.connect(9999)

stream.pipe(master.createStream({tail: true})).pipe(stream)
```

Wow, that was simple.

## Binary data.

by default, level-replicate supports buffers by converting them to base64 via `stream-serializer` and `json-buffer`.
If you desire more efficiency, use `level-replicate/msgpack`

``` js
var Replicate = require('level-replicate/msgpack')

var db = SubLevel(level('/tmp/example-slave'))
var master = Replicate(db, 'master', "MASTER-2")
```

## Replicating Sublevels Recursively

```js
//install Master plugin with the `recursive` option set to `true`.
var master = Replicate(db, 'master', "MASTER-1", {recursive: true})

// changes made to all sublevels of `db` will replicate!
db.sublevel('documents').put('foo', {bar: 'baz'}, function() { ... })
```

> note: this depends on having level-sublevel@>=5.2.0 with level-hooks@>=4.5.0

<!--

## did someone say "webscale"?

### master in the middle

writes go to the master, and are then copied to many slaves.
requests are load balanced across the slaves...

### slave in the middle

A large amount of data is written to many masters.
Each master aggregates the data (probably with a module like
[map-reduce](https://github.com/dominictarr/map-reduce)),
and then the _aggregation_ is replicated into the central slave.

The central slave the applies the same aggregation _again_,
giving you global data.

(it's important here that the data from each node does not collide.
keys from each node need a different prefix or to be stored in a
separate [sublevel](https://github.com/dominictarr/level-sublevel))

-->

## License

MIT
