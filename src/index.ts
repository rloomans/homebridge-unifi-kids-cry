import {UBNTClient} from "./ubntClient";

var Accessory, Service, Characteristic, UUIDGen;

const moduleName = "homebridge-unifi-mac-block"
const platformName = "UnifiMacBlocker"
interface device {
    mac: string
    name: string
}
interface config {
    base: string
    site: string
    username: string
    password: string
    devices: device[]
}

export class UnifiKidsCry {
    client: UBNTClient
    accessories: any[] = []
    refreshInterval: number
    constructor(private readonly log: (string) => void, config: config, private api: any) {
        if (!config) {
            return
        }
        this.log = log
        this.api = api
        this.refreshInterval = config['refreshInterval'] || 5;
        this.refreshInterval = this.refreshInterval * 1000;
        this.client = new UBNTClient(config.base, config.site, config.username, config.password)
        this.api.on('didFinishLaunching', () => this.finishedLoading(config))
    }

    configureAccessory(accessory) {
        this.accessories.push(accessory)
        this.bindLockService(accessory.getService("network"), accessory.context.mac)
    }

    refresh(mac: string, service: any) {
        //this.log(`fetching refreshments for ${mac} ${service.updating}`)
        if(!service.updating) {
            this.client.isBlocked(mac).then((current) => {
                //this.log(`on callback ${mac} blocked ${current}`)
                let value = current === true ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED
                service.getCharacteristic(Characteristic.LockCurrentState).updateValue(value);
                service.getCharacteristic(Characteristic.LockTargetState).updateValue(value)
            }).catch((shit) => {
                this.log(shit)
                service.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNKNOWN);
            })
        }
        setTimeout(() => this.refresh(mac, service), this.refreshInterval)
    }

    finishedLoading(config: config) {
        //now del the ole stale shit
        for(let acc of this.accessories) {
            if(config.devices.filter((d) => d.mac === acc.context.mac).length === 0) {
                this.log(`removing ${acc.context.mac}`)
                this.api.unregisterPlatformAccessories(moduleName, platformName, [acc]);
            }
        }
        //add the new hotness
        for(let dev of config.devices) {
            if(this.accessories.filter((t) => t.context.mac === dev.mac).length === 0){
                this.createAccessory(dev)
            }
        }
    }

    createAccessory(dev:device) {
        let uuid = UUIDGen.generate(dev.mac);
        const newAccessory = new Accessory(dev.mac, uuid);
        newAccessory.context.mac = dev.mac
        newAccessory.reachable = true;
        newAccessory.getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.SerialNumber, dev.mac);
        let lockService = newAccessory.addService(Service.LockMechanism, "network")
        newAccessory.addService(Service.LockManagement, 'admin')
            .setCharacteristic(Characteristic.AdministratorOnlyAccess, true);
        this.bindLockService(lockService, dev.mac)
        this.api.registerPlatformAccessories(moduleName, platformName, [newAccessory]);
        this.log(`added ${dev.name} at mac ${dev.mac}`)
    }

    bindLockService(service, mac: string) {
        let clazz = this
        service.getCharacteristic(Characteristic.LockTargetState)
            .on('set', function (value, callback) {
                service.updating = true
                clazz.log('now we are setting some shit')
                let result: Promise<boolean>
                if (value === Characteristic.LockTargetState.SECURED) {
                    result = clazz.client.blockMac(mac).then((res)=> res === true ? Characteristic.LockTargetState.SECURED : Characteristic.LockTargetState.UNSECURED)
                } else if (value === Characteristic.LockTargetState.UNSECURED) {
                    result = clazz.client.unblockMac(mac).then((res) => res === true ? Characteristic.LockTargetState.UNSECURED : Characteristic.LockTargetState.SECURED)
                } else {
                    result = clazz.client.isBlocked(mac).then((current) => {
                        clazz.log(`${mac} is in blocked state ${current}`)
                        return (current === true ? Characteristic.LockCurrentState.SECURED: Characteristic.LockCurrentState.UNSECURED)
                    })
                }
                result.then((want) => {
                    service.getCharacteristic(Characteristic.LockCurrentState).updateValue(want);
                    callback(null)
                    service.updating = false
                })
                .catch((shit) => {
                    clazz.log(shit)
                    service.getCharacteristic(Characteristic.LockCurrentState).updateValue(Characteristic.LockCurrentState.UNKNOWN);
                    callback(null)
                    service.updating = false
                })
            })
        service.getCharacteristic(Characteristic.LockCurrentState)
            .on('get', function (callback) {
                clazz.client.isBlocked(mac).then((current) =>{
                    clazz.log(`${mac} blocked ${current}`)
                    service.getCharacteristic(Characteristic.LockCurrentState).updateValue(current === true ? Characteristic.LockCurrentState.SECURED: Characteristic.LockCurrentState.UNSECURED);
                    callback(null, current === true ? Characteristic.LockCurrentState.SECURED: Characteristic.LockCurrentState.UNSECURED)
                }).catch((shit) =>{
                    clazz.log(shit)
                    service.getCharacteristic(Characteristic.LockCurrentState).updateValue(Characteristic.LockCurrentState.UNKNOWN);
                    callback(null, Characteristic.LockCurrentState.UNKNOWN)

                })
            })
        this.refresh(mac, service)
    }
}

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;

    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerPlatform(moduleName, platformName, UnifiKidsCry, true);
}


