const uuid = require('uuid');
const Server = require('masterless');
const { EventEmitter } = require('events');
const { Subject } = require('rxjs');
const { Set } = require('immutable');
const { getLogger, levels } = require('log4js');

class Mesh {
  constructor(config) {
    if (!config) config = {};
    this.peers = Set();
    this.id = config.id || uuid();
    this.log = getLogger(`Mesh`);
    this.log.setLevel(config.logLevel || levels.OFF);
    this.server = new Server(this.id, {host: config.host, port: config.port});
    this.server.on('listening', (info) => {
      try {
        this.log.info(`Listening on ${info}`)
        this.info = info;
        if (config.connect) {
          this.log.info(`Connecting to peer: tcp://${config.connect.host}:${config.connect.port}`);
          this.server.connect(`tcp://${config.connect.host}:${config.connect.port}`);
        }
      } catch (e) { this.log.error(e); }
    });
    this.server.on('connect', (peer) => {
      try {
        this.log.info(`Peer connected: ${peer}`);
        // Broadcast self to new peers. Exclude existing peers.
        if (!this.peers.has(peer)) {
          this.server.keep(peer);
          this.peers = this.peers.add(peer);
          this.broadcast({
            type: '_introduce',
            id: this.id,
            info: this.info
          }, {
            // Exclude existing peers:
            exclude: this.peers.delete(peer)
          })
        }
      } catch (e) { this.log.error(e); }
    });

    // Receive incoming messages
    const incoming = new Subject();
    this.incoming = incoming.asObservable();
    this.server.on('message', (sender, message) => {
      try {
        this.log.debug(`Received: ${JSON.stringify(message)} from ${sender}`)
        incoming.next(message);
      } catch (e) { this.log.error(e) }
    })

    // Handle broadcasts
    this.incoming.filter((x) => x.type === '_broadcast')
      .subscribe(({sender, message, exclude}) => {
        incoming.next(message);
        this.broadcast(message, {
          exclude,
          sender
        })
      })

    // handle introductions
    this.incoming.filter((x) => x.type === '_introduce')
      .subscribe(({id, info}) => {
        if (!this.peers.has(id)) {
          this.peers = this.peers.add(id);
          this.log.info(`Connecting to new peer: ${id} at ${info}`);
          this.server.connect(info);
        }
      })

    // handle shutdowns
    this.incoming.filter((x) => x.type === '_shutdown')
      .subscribe(({id}) => {
        this.log.info(`Releasing connection to ${id}`);
        this.peers = this.peers.delete(id);
        this.server.keep(id, false);
      })
  }

  broadcast(message, options) {
    this.log.debug(`Broadcasting: ${JSON.stringify(message)} with ${JSON.stringify(options)}`)
    const exclude = Set(options && options.exclude || []);
    const recipients = this.peers.subtract(exclude).subtract(this.id);
    const newExclude = exclude.union(recipients).add(this.id);
    this.emit({
      type: '_broadcast',
      message: message,
      sender: options && options.sender || this.id,
      exclude: newExclude
    }, {
      recipients: recipients
    });
  }

  emit(msg, options) {
    const recipients = Set(options && options.recipients || this.peers);
    recipients.forEach((id) => {
      this.log.debug(`Emitting ${JSON.stringify(msg)} to ${id}`);
      this.send(id, msg)
    });
  }

  send(id, message) {
    this.server.send(id, message)
  }

  close() {
    this.log.info('Shutting down');
    this.broadcast({
      type: '_shutdown',
      id: this.id
    });
    this.server.close();
  }
}

module.exports = Mesh;
