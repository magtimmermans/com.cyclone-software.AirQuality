'use strict';

const Homey = require('homey');
const LuchtmeetGrabber = require('./LuchtmeetGrabber.js');

const MINUTE = 60000;

const LKIToken = new Homey.FlowToken( 'lkitoken', {
	type: 'number',
	title: Homey.__("lki")
});
const lastLKIUpdateToken = new Homey.FlowToken( 'lastLKIUpdateToken', {
	type: 'string',
	title: Homey.__("LastUpdateLKI")
});

class AirQuality extends Homey.App {
	
	async onInit() {
		this.log(`${Homey.manifest.id} V${Homey.manifest.version} is running...`);

		this.registerTokes();
		this.initFlows();
		this.stationData = {
            "timestamp_measured": "2019-05-26T00:00:00+00:00",
            "value": 0,
            "formula": "LKI",
            "station_number": "NL00000"
        }

		await this.registerLuchtmeetGrabber();
		Homey.ManagerGeolocation.on('location', this.registerLuchtmeetGrabber.bind(this));

		this.station = await this.lm_api.getClosedStation();

		console.log(this.station);

		this.startSyncing();

	}

	registerTokes(){
		LKIToken.register()
		.catch( err => {
		  this.error( err );
		});
		lastLKIUpdateToken.register().catch(err => {this.error(err)});
	}

	initFlows() {
		this.lki3Trigger = new Homey.FlowCardTrigger('lki3').register();
		this.lki6Trigger = new Homey.FlowCardTrigger('lki6').register();
		this.lki8Trigger = new Homey.FlowCardTrigger('lki8').register();
		this.lki10Trigger = new Homey.FlowCardTrigger('lki10').register();
		this.lki12Trigger = new Homey.FlowCardTrigger('lki12').register();
		this.lkiTrigger = new Homey.FlowCardTrigger('lkitrigger').register();
	}

	async registerLuchtmeetGrabber() {
		const latitude = Homey.ManagerGeolocation.getLatitude();
		const longitude = Homey.ManagerGeolocation.getLongitude();

		this.lm_api = new LuchtmeetGrabber({ lat: latitude, lon: longitude });
	}

	async startSyncing() {
		// Prevent more than one syncing cycle.
		if (this.isSyncing) return;

		// Start syncing.
		this.log('starting sync');
		this.poll();
	}


	async poll() {
		// Check if it is raining at this moment
		this.isSyncing = true;
		try {
			this.log("polling ...");
			let prevStationData = this.stationData;
			this.stationData = await this.lm_api.getStationMeasurements(this.station.number);
			if (this.stationData) {
				if (prevStationData)
				{
					if (prevStationData.value!=this.stationData.value) {
						LKIToken.setValue(this.stationData.value).catch(err => {this.error( err )});
						// do some triggering
						let i = this.stationData.value
						
						this.lkiTrigger.trigger({
							'lki': i
						  }).catch( this.error ).then( this.log )
						
						switch (true) {
							case i<=3:
								//  Goed
								this.lki3Trigger.trigger().catch( this.error ).then( this.log )
								this.log('Goed');
								break;
							case i<=6:
								// Matig
								this.lki6Trigger.trigger().catch( this.error ).then( this.log )
								this.log('Matig');
								break;
							case i<=8:
								// Onvoldoende
								this.lki8Trigger.trigger().catch( this.error ).then( this.log )
								this.log('Onvoldoende');
								break;
							case i<=10:
								// Slecht
								this.lki10Trigger.trigger().catch( this.error ).then( this.log )
								this.log('Slecht');
								break;
							case i<12:
								// Zeer slecht
								this.lki12Trigger.trigger().catch( this.error ).then( this.log )
								this.log('Zeer Slecht');
								break;
							default:
								break;
						}
					}
				} else {
					LKIToken.setValue(this.stationData.value).catch(err => {this.error( err )});
				}
				let ds = this.stationData.timestamp_measured.slice(0, 19).replace('T', ' ');
				lastLKIUpdateToken.setValue(ds).catch(err => {this.error( err )});
			}
		} catch (error) {
			this.isSyncing = false;
		}

		this.isSyncing = false;

		// Schedule next sync.
		this.timeout = setTimeout(
			() => this.poll(),
			30 * MINUTE,
		);
	}

}

module.exports = AirQuality;