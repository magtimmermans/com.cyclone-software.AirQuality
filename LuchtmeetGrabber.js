'use strict';

const fetch = require('node-fetch');

module.exports = class LuchtmeetGrabber {

	constructor({ lat, lon } = {}) {
		this.lat = lat;
		this.lon = lon;
    }
    
    async getClosedStation() {
      const locations = await this.getStations();
      console.log(`Loaded ${locations.length} stations`);
      var closest=locations[0];
      var closest_distance=this.FGCD(closest.longitude,closest.latitude,this.lon,this.lat);
      for(var i=1;i<locations.length;i++){
        if(this.FGCD(locations[i].longitude,locations[i].latitude,this.lon,this.lat)<closest_distance){
            console.log(closest_distance);
            closest_distance=this.FGCD(locations[i].longitude,locations[i].latitude,this.lon,this.lat)
            closest=locations[i];
        }
      }
      return closest;
    }

    	// Get distance between 2 coordinates. Not very accurate but a least very fast :)
	FGCD(dlong1, dlat1, dlong2, dlat2) {
		let c = dlong1 - dlong2;
		let d = dlat1 - dlat2;
		c *= 66.997;
		d *= 111.3;
		return (Math.sqrt((d * d) + (c * c)) * 1000); // in meters
    }

    async getStationLKIData(station){
        console.log(`get LKI Data ${station}`);
        const res = await fetch(` https://api.luchtmeetnet.nl/open_api/lki?station_number=${station}&order_by=timestamp_measured&order_direction=desc`);
		if (!res.ok) throw new Error('Unknown Error');
		const data = await res.json();
		return data
    }
    
    async getStationMeasurements(station) {

        console.log(`getStationMeasurements for station : ${station}`);
        var stationDatas = await this.getStationLKIData(station);
       // console.log(stationDatas);
        if (stationDatas && stationDatas.data.length>0) {
            return stationDatas.data[0];
        } else
            return null;
    }

	async getStationPage(page){
		const res = await fetch(`https://api.luchtmeetnet.nl/open_api/stations?page=${page}&order_by=number&organisation_id=`);
		if (!res.ok) throw new Error('Unknown Error');
		const data = await res.json();
		return data
    }
    
    async getStationData(number){
        const res = await fetch(`https://api.luchtmeetnet.nl/open_api/stations/${number}/`);
        if (!res.ok) throw new Error('Unknown Error');

        try {
            const data = await res.json(); 
            return { 
                number : number,
                longitude : data.data.geometry.coordinates[1],
                latitude :  data.data.geometry.coordinates[0],
                location : data.data.location,
                province : data.data.province
            }              
        } catch (error) {
            return { 
                number : number,
                longitude : 0,
                latitude :  0,
                location : '',
                province : ''
            } 
        } 
    }

	async getStations() {

        const me = this;
        
        var StationArray = [];    

        var stations = await me.getStationPage('');

        await asyncForEach(stations.pagination.page_list, async (page) => {
                var stats = await me.getStationPage(page);        
              
                console.log(`Page number:${page}`);
                await asyncForEach(stats.data,async station => {
                  StationArray.push(this.getStationData(station.number).then((result) => {
                        return result;
                   }));
                 });
        });

        const results = await Promise.all(StationArray);
        return results;
     }
};

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}

