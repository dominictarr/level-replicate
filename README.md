# level-master

master-master replication with levelup.

Implements scuttlebutt style handshake and then syncs data, then replicates real time changes.

## Example

Replicate from a between two processes.
One process starts a server, and another connects.

``` js
//master1.js
var levelup  = require('levelup')
var SubLevel = require('level-sublevel')
var net      = require('net')
var Replicate   = require('level-replicate')

//setup the database.
var db = SubLevel(levelup('/tmp/example-master'))

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
var levelup  = require('levelup')
var SubLevel = require('level-sublevel')
var net      = require('net')
var Master   = require('level-master')

var db = SubLevel(levelup('/tmp/example-slave'))
var master = Replicate(db, 'master', "MASTER-2")

var stream = net.connect(9999)

stream.pipe(master.createStream({tail: true})).pipe(stream)
```

Wow, that was simple.

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
