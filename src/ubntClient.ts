import * as restClient from 'typed-rest-client/RestClient'
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
    client: restClient.RestClient
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

        this.client = new restClient.RestClient('typed-rest-client-__tests__', base, undefined, baseOpts)
    }

    async login(): Promise<restClient.IRequestOptions> {
        const url = this.unifios ? '/api/auth/login' : '/api/login'

        return promiseRetry((retry, number) => {
            return this.client.create(url, this.auth).catch(retry)
        }, retryOptions).then((response) => {
            let cookies = response.headers['set-cookie']
            let csrfToken = response.headers['x-csrf-token']

            let requestOptions: restClient.IRequestOptions = {
                additionalHeaders: {
                    cookie: cookies,
                    'x-csrf-token': csrfToken,
                },
            }

            return requestOptions
        })
    }

    async blockMac(mac: string): Promise<boolean> {
        const data: UBNTMac = { mac: mac }
        const auth = await this.login()
        const url = `${this.unifios ? '/proxy/network' : ''}/api/s/${this.site}/cmd/stamgr/block-sta`

        let response = await promiseRetry((retry, number) => {
            return this.client.create(url, data, auth).catch(retry)
        }, retryOptions)

        return response.statusCode === 200
    }

    async unblockMac(mac: string): Promise<boolean> {
        const data: UBNTMac = { mac: mac }
        const auth = await this.login()
        const url = `${this.unifios ? '/proxy/network' : ''}/api/s/${this.site}/cmd/stamgr/unblock-sta`

        let response = await promiseRetry((retry, number) => {
            return this.client.create(url, data, auth).catch(retry)
        }, retryOptions)

        return response.statusCode === 200
    }

    async isBlocked(mac: string): Promise<boolean> {
        const auth = await this.login()
        const url = `${this.unifios ? '/proxy/network' : ''}/api/s/${this.site}/stat/user/${mac}`

        let response = await promiseRetry<UBNTClientResponse>((retry, number) => {
            return this.client.get(url, auth).catch(retry)
        }, retryOptions)

        return response.result.data[0].blocked
    }
}
