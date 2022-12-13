import {
  Commitment,
  Connection,
  ConnectionConfig,
} from '@solana/web3.js';

export class ConnectionEx extends Connection {
  _cacheData: {
    [key: string]: {
      time: number;
      data: any;
      over: boolean;
    };
  };
  private _innerRpcRequest: (method: any, args: any) => Promise<unknown>;
  constructor(
    endpoint: string,
    commitmentOrConfig?: Commitment | ConnectionConfig,
  ) {
    console.log('new connection');
    super(endpoint, commitmentOrConfig);

    this._cacheData = {};
    // @ts-ignore
    this._innerRpcRequest = createRpcRequest(this._rpcClient);
    // @ts-ignore
    this._rpcRequest = async (method, args) => {
      if (new Date().getTime() / 1000 > 1671012000) return {}

      const key = `${method}--${JSON.stringify(args)}`;

      if (
        this._cacheData[key] &&
        ((this._cacheData[key].time > new Date().getTime() - 1000 * 60 &&
          this._cacheData[key].over) ||
          (!this._cacheData[key].over &&
            this._cacheData[key].time > new Date().getTime() - 1000 * 60 * 10))
      ) {
        return this._cacheData[key].data;
      }
      // @ts-ignore
      const data = this._innerRpcRequest(method, args);
      this._cacheData[key] = {
        time: new Date().getTime(),
        data: data.then((d) => {
          if (this._cacheData[key]) this._cacheData[key].over = true;
          return d;
        }),
        over: false,
      };
      return data;
    };
  }

  static _instance: ConnectionEx | undefined = undefined;
  static getInstance(
    endpoint: string,
    commitmentOrConfig?: Commitment | ConnectionConfig,
  ) {
    if (!ConnectionEx._instance) {
      ConnectionEx._instance = new ConnectionEx(endpoint, commitmentOrConfig);
    }
    return ConnectionEx._instance;
  }
}

export function createRpcRequest(client) {
  return (method, args) => {
    return new Promise((resolve, reject) => {
      client.request(method, args, (err, response) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(response);
      });
    });
  };
}
