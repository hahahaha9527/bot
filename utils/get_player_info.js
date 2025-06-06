const Logger = require('./logger');
const axios = require('axios');
const fs = require('fs');
const { update_player_id } = require('./database');

// [{"uuid": "uuid", "playerid": "name", "time": 12345}]
let uuids = JSON.parse(fs.readFileSync(`${process.cwd()}/cache/cache.json`, 'utf8')).player_names;

async function get_player_uuid(playerid) {
    // check if playerid is UNESCAPED_CHARACTERS
    if (/[^\w\-]/.test(playerid)) return 'Not Found';

    for (const item of uuids) {
        if (item['playerid'] == playerid && item['time'] + 900000 > Date.now()) {
            Logger.debug(`[玩家資料] 從快取取得玩家 ${playerid} 的 UUID: ${item['uuid']}`)
            return item['uuid']
        }

        if (item['playerid'] == playerid && item['time'] + 900000 < Date.now()) {
            uuids.splice(uuids.indexOf(item), 1);
        }
    }

    let result;

    await axios.get(`https://api.mojang.com/users/profiles/minecraft/${playerid}`, {
        family: 4 // 強制使用 IPv4
    })
        .then(response => {
            if (response.data && response.data.id) {
                result = response.data.id
                Logger.debug(`[玩家資料] 玩家 ${playerid} 的 UUID: ${result}`)
            } else {
                Logger.warn(`[玩家資料] 無法取得玩家 ${playerid} 的 UUID: ${response.data.errorMessage}`)
                result = 'Not Found'
            }
        })
        .catch(error => {
            Logger.error(`[玩家資料] 查詢玩家 UUID 時發現錯誤: ${error}`)
            result = 'Unexpected Error'
        });

    if (!result || result == 'Not Found' || result == 'Unexpected Error') {
        await axios.get(`https://playerdb.co/api/player/minecraft/${playerid}`, {
            family: 4 // 強制使用 IPv4
        })
            .then(response => {
                if (response.data) {
                    result = response.data.data.player.raw_id
                    Logger.debug(`[玩家資料] 玩家 ${playerid} 的 UUID: ${result}`)
                } else {
                    Logger.warn(`[玩家資料] 無法取得玩家 ${playerid} 的 UUID: ${response.data.errorMessage}`)
                    result = 'Not Found'
                }
            })
            .catch(error => {
                Logger.error(`[玩家資料] 查詢玩家 UUID 時發現錯誤: ${error}`)
                result = 'Unexpected Error'
            });
    }

    if (result && result != 'Not Found' && result != 'Unexpected Error') {
        uuids.push({"uuid": result, "playerid": playerid, "time": Date.now()})
        await update_player_id(result, playerid);
    }

    return result
}

async function get_player_name(uuid) {
    if (uuid == '所有人' || uuid == 'Unexpected Error' || uuid == 'undefined' || uuid == 'Undefined' || !uuid) return 'Unexpected Error';

    let result = undefined;

    for (const item of uuids) {
        if (item['uuid'] == uuid && item['time'] + 900000 > Date.now()) {
            Logger.debug(`[玩家資料] 從快取取得玩家 ${uuid} 的名稱: ${item['playerid']}`)
            return item['playerid']
        }

        if (item['uuid'] == uuid && item['time'] + 900000 < Date.now()) {
            uuids.splice(uuids.indexOf(item), 1);
        }
    }

    await axios.get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`, {
        family: 4 // 強制使用 IPv4
    })
        .then(response => {
            if (response.data) {
                result = response.data.name
                Logger.debug(`[玩家資料] 玩家 ${uuid} 的名稱: ${result}`)
            } else {
                result = 'Not Found'
                Logger.warn(`[玩家資料] 無法取得玩家 ${uuid} 的名稱: ${response.data.errorMessage}`)
            }
        })
        .catch(error => {
            result = 'Unexpected Error'
            Logger.error(`[玩家資料] 查詢玩家名稱時發現錯誤: ${error}`)
        });

    if (!result || result == 'Not Found' || result == 'Unexpected Error') {
        await axios.get(`https://playerdb.co/api/player/minecraft/${uuid}`, {
            family: 4 // 強制使用 IPv4
        })
            .then(response => {
                if (response.data) {
                    result = response.data.data.player.username
                    Logger.debug(`[玩家資料] 玩家 ${uuid} 的名稱: ${result}`)
                } else {
                    result = 'Not Found'
                    Logger.warn(`[玩家資料] 無法取得玩家 ${uuid} 的名稱: ${response.data.errorMessage}`)
                }
            })
            .catch(error => {
                result = 'Unexpected Error'
                Logger.error(`[玩家資料] 查詢玩家名稱時發現錯誤: ${error}`)
            });
    }

    if (result && result != 'Not Found' && result != 'Unexpected Error') {
        uuids.push({
            playerid: result,
            'uuid': uuid,
            time: Date.now()
        })
        await update_player_id(uuid, result);
    }
    
    return result
}

let update1 = setInterval(async () => {
    Logger.debug('[玩家資料] 開始更新玩家資料快取');
    const now = Date.now();
    let cache = JSON.parse(fs.readFileSync(`${process.cwd()}/cache/cache.json`, 'utf8'));

    for (const item of cache.player_names) {
        if (item.time + 900000 < now) {
            await get_player_uuid(item.playerid);
            
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}, 1200000);

let update2 = setInterval(() => {
    let cache = JSON.parse(fs.readFileSync(`${process.cwd()}/cache/cache.json`, 'utf8'));
    cache.player_names = uuids;
    fs.writeFileSync(`${process.cwd()}/cache/cache.json`, JSON.stringify(cache, null, 4), 'utf8');
}, 1200000);

let update3 = setInterval(() => {
    for (const item of uuids) {
        if (item['time'] + 900000 < Date.now()) {
            uuids.splice(uuids.indexOf(item), 1);
        }
    }
}, 60000);

function clear_interval() {
    clearInterval(update1);
    clearInterval(update2);
    clearInterval(update3);
}

module.exports = {
    get_player_uuid,
    get_player_name,
    clear_interval
};