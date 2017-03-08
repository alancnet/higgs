const Mesh = require('./mesh');
const promisary = require('./promisary');

class Injector {
  constructor(config) {
    this.mesh = new Mesh(config);
    this._services = {};

    // Handle provide advertisements
    this.mesh.incoming.filter((x) => x.type === 'provide')
      .subscribe(({id, name}) => {
        const service = this._ensureService(name);
        service.global = true;
        service.local = false;
        if (!service.result) {
          service.accept([id]);
        } else {
          service.result.push(id);
        }
      });

  }

  provideLocal(name, provider) {
    const service = this._ensureService(name);
    service.global = false;
    service.local = true;
    service.accept(provider);
    return service;
  }

  provideGlobal(name, provider) {
    this.mesh.broadcast({
      type: 'provide',
      id: this.mesh.id,
      name: name
    });
    // TODO: Register listener to handle requests
    // TODO: Figure out how to handle responses


  }
  // TODO: Create inject(...) method
  // TODO: Wrap global providers in promises

  _ensureService(name) {
    if (!this._services[name]) {
      this._services[name] = promisary();
    }
    return this._services[name];
  }

}
