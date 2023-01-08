
const scrapeIt = require('scrape-it');
const { MongoClient } = require('mongodb');
const mongoConnectionString = process.env.mongoConnectionString;
const mongoDBName = process.env.mongoDBName;
const mongoCollectionName = process.env.mongoCollectionName;

const url = `mongodb+srv://${mongoConnectionString}/?retryWrites=true&w=majority`;
const client = new MongoClient(url);

const SF_CRUNCH_LOCATIONS = ['union-street', 'polk-st', 'chestnut', 'new-montgomery', 'yerba-buena']

const fetchLocationOccupancyData = async (location) => {
    // fetch location data via site and known html tags
    const { data: rawData } = await scrapeIt(`https://www.crunch.com/locations/${location}`, {
        occupancyStatus:'#crunch-o-meter #occupancy-info .ocupancy-status',
        capacityMoto:'#crunch-o-meter #occupancy-info .capacity-moto',
        fillRate: { selector: '#crunch-o-meter #occupancy-info .progress-bar', attr: 'style' }
    })
    
    // extract percent filled by removing styling (ex.: 'width: 50%' -> '50') 
    rawData.fillRate = rawData.fillRate.replace("width: ", "").replace("%", "")
    // add our time/place metadata 
    rawData.createdAt = new Date();
    rawData.location = location;

    return rawData
}

const storeLocationData = async (data) => {
    try {
            // Use connect method to connect to the server
            await client.connect();
            console.log('Connected successfully to server');
            const db = client.db(mongoDBName);
            const occupancyCollection = db.collection(mongoCollectionName);
            
            const result = await occupancyCollection.insertOne(data);
            console.log(`A document was inserted with the _id: ${result.insertedId}`);
    } finally {
        await client.close()
    }
    

}

const main = async () => {
    const fetchDataPromises = SF_CRUNCH_LOCATIONS.map(fetchLocationOccupancyData)

    const locationOccupanciesResults = await Promise.all(fetchDataPromises)
    for (locationOccupancy of locationOccupanciesResults) {
        await storeLocationData(locationOccupancy)    
    }
    
}

main().catch(console.dir);
