import * as restm from 'typed-rest-client/RestClient'
import { IRequestOptions } from 'typed-rest-client/Interfaces'
import * as promiseRetry from 'promise-retry'

interface UBNTLogin {
    username: string
    password: string
}

interface UBNTMac {
    mac: string
}

interface UBNTClientData {
    blocked: boolean
}

interface UBNTClientResponse {
    meta: Object
    data: UBNTClientData[]
}

const baseOpts: IRequestOptions = {
    ignoreSslError: true,
}

const retryOptions = {
    retries: 3,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 2000,
    randomize: true,
}

export class UBNTClient {
    client: restm.RestClient
    auth: UBNTLogin
    site: string
    unifios: boolean
    constructor(base: string, site: string, unifios: boolean, user: string, password: string) {
        this.auth = {
            username: user,
            password: password,
        }
        this.site = site
        this.unifios = unifios

        this.client = new restm.RestClient('typed-rest-client-__tests__', base, undefined, baseOpts)
    }

    async login(): Promise<restm.IRequestOptions> {
        return promiseRetry(function (retry, number) {
            return this.client.create(this.unifios ? '/api/auth/login' : '/api/login', this.auth).catch(retry)
        }, retryOptions)
            .bind(this)
            .then((response) => {
                let cookies = response.headers['set-cookie']
                let csrfToken = response.headers['x-csrf-token']

                let reqOpts: restm.IRequestOptions = {
                    additionalHeaders: {
                        cookie: cookies,
                        'x-csrf-token': csrfToken,
                    },
                }

                return reqOpts
            })
    }

    async blockMac(mac: string): Promise<boolean> {
        let data: UBNTMac = { mac: mac }
        let auth = await this.login()
        let res = await promiseRetry(function (retry, number) {
            return this.client
                .create(`${this.unifios ? '/proxy/network' : ''}/api/s/${this.site}/cmd/stamgr/block-sta`, data, auth)
                .catch(retry)
        }, retryOptions).bind(this)

        return res.statusCode === 200
    }

    async unblockMac(mac: string): Promise<boolean> {
        let data: UBNTMac = { mac: mac }
        let auth = await this.login()
        let res = await promiseRetry(function (retry, number) {
            return this.client
                .create(`${this.unifios ? '/proxy/network' : ''}/api/s/${this.site}/cmd/stamgr/unblock-sta`, data, auth)
                .catch(retry)
        }, retryOptions)

        return res.statusCode === 200
    }

    async isBlocked(mac: string): Promise<boolean> {
        let auth = await this.login()
        let ret = await promiseRetry<UBNTClientResponse>(function (retry, number) {
            return this.client
                .get(`${this.unifios ? '/proxy/network' : ''}/api/s/${this.site}/stat/user/${mac}`, auth)
                .catch(retry)
        }, retryOptions).bind(this)

        return ret.result.data[0].blocked
    }
}
