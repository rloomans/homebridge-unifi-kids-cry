"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UBNTClient = void 0;
const restClient = require("typed-rest-client/RestClient");
const promiseRetry = require("promise-retry");
const baseOpts = {
    ignoreSslError: true,
};
const retryOptions = {
    retries: 3,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 2000,
    randomize: true,
};
class UBNTClient {
    constructor(base, site, unifios, user, password) {
        this.auth = {
            username: user,
            password: password,
        };
        this.site = site;
        this.unifios = unifios;
        this.client = new restClient.RestClient('typed-rest-client-__tests__', base, undefined, baseOpts);
    }
    login() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.unifios ? '/api/auth/login' : '/api/login';
            return promiseRetry((retry, number) => {
                return this.client.create(url, this.auth).catch(retry);
            }, retryOptions).then((response) => {
                let cookies = response.headers['set-cookie'];
                let csrfToken = response.headers['x-csrf-token'];
                let requestOptions = {
                    additionalHeaders: {
                        cookie: cookies,
                        'x-csrf-token': csrfToken,
                    },
                };
                return requestOptions;
            });
        });
    }
    blockMac(mac) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = { mac: mac };
            const auth = yield this.login();
            const url = `${this.unifios ? '/proxy/network' : ''}/api/s/${this.site}/cmd/stamgr/block-sta`;
            let response = yield promiseRetry((retry, number) => {
                return this.client.create(url, data, auth).catch(retry);
            }, retryOptions);
            return response.statusCode === 200;
        });
    }
    unblockMac(mac) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = { mac: mac };
            const auth = yield this.login();
            const url = `${this.unifios ? '/proxy/network' : ''}/api/s/${this.site}/cmd/stamgr/unblock-sta`;
            let response = yield promiseRetry((retry, number) => {
                return this.client.create(url, data, auth).catch(retry);
            }, retryOptions);
            return response.statusCode === 200;
        });
    }
    isBlocked(mac) {
        return __awaiter(this, void 0, void 0, function* () {
            const auth = yield this.login();
            const url = `${this.unifios ? '/proxy/network' : ''}/api/s/${this.site}/stat/user/${mac}`;
            let response = yield promiseRetry((retry, number) => {
                return this.client.get(url, auth).catch(retry);
            }, retryOptions);
            return response.result.data[0].blocked;
        });
    }
}
exports.UBNTClient = UBNTClient;
//# sourceMappingURL=ubntClient.js.map