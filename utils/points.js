const fs = require('fs');
const filePath = './data/points.json';

function loadPoints() {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath));
}

function savePoints(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function addPoints(playerId, points) {
    const db = loadPoints();
    db[playerId] = (db[playerId] || 0) + points;
    savePoints(db);
}

function getPoints(playerId) {
    const db = loadPoints();
    return db[playerId] || 0;
}

function reducePoints(playerId, points) {
    const db = loadPoints();
    db[playerId] = Math.max((db[playerId] || 0) - points, 0);
    savePoints(db);
}

module.exports = { addPoints, getPoints, reducePoints };
