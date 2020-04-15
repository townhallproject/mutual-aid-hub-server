const request = require('superagent');
const _ = require('lodash');

const moment = require('moment-timezone');
const {
    firestore
} = require('../lib/setupFirebase');
const headers = require('../constants');
const validate = require('../lib/schema');

class MutualAidNetwork {

    static makeEventFromSpreadSheet(row) {
        const out = {};
        headers.forEach((key, i) => {
            out[key] = row[i]
        })
        return out;
    }
// validate.mutualAidNetworkSchema.properties
    static getEmptyValue(key) {
        if (!validate.mutualAidNetworkSchema.properties[key]) {
            console.log('not found', key)
            return -1;
        }
        switch (validate.mutualAidNetworkSchema.properties[key].type) {
            case "string":
                return '';
            case "integer":
                return 0;
            case "number":
                return 0;
            case "array":
                return [];
            case "boolean":
                return false;
        }
        
    }

    constructor(obj) {
        for (let key in obj) {
            this[key] = obj[key] ? obj[key].trim() : undefined;
        }
        this.displayFilterTags = this.displayFilterTags ? this.displayFilterTags.split(',') : [];
        this.backendTags = this.backendTags ? this.backendTags.split(',') : [];

    }

    hasField(field) {
        return this[field] && this[field].length > 0;
    }

    checkIfExists() {
        return firestore.collection("mutual_aid_networks").where("title", "==", this.title)
            .get()
            .then(function (querySnapshot) {
                if (!querySnapshot.empty) {
                    let networks = [];
                    querySnapshot.forEach(ele => {
                        let network = {
                            ...ele.data(),
                            id: ele.id
                        };
                        networks.push(network);
                    })
                    return networks;
                } else {
                    return false;
                }
            })
            .catch(function (error) {
                console.log("Error getting documents: ", error);
            });
    }


    //geocodes an address
    getLatandLog() {
        const address = `${this.city || ''} ${this.state || ''}`;
        var addressQuery = escape(address);

        const type = this.city ? 'place' : 'region';
        const country = this.country === 'USA' ? 'us' : this.country === 'Canada' ? 'ca' : '';
        const apiUrl = "https://api.mapbox.com";
        const url = `${apiUrl}/geocoding/v5/mapbox.places/${addressQuery}.json?access_token=${process.env.MAPBOX_API_KEY}&types=${type}&country=${country}`;
        return request
            .get(url)
            .then(returned => {
                const {
                    body
                } = returned;
                if (body.features && body.features.length) {
                    const data = body.features[0];
                    this.address = data.matching_place_name || data.place_name;
                    this.lat = data.center[1];
                    this.lng = data.center[0];
                    this.bbox = data.bbox;
                    return this;
                }
            })
    }

    async getTimeZone() {
        const url = `http://api.timezonedb.com/v2.1/get-time-zone?key=${process.env.TIME_ZONE_API_KEY}&format=json&by=position&lat=${this.lat}&lng=${this.lng}`;
        let returned = await request
            .get(url);
        const {
            body
        } = returned;
        if (body && body.abbreviation) {
            this.timeZone = body.abbreviation;
            this.zoneName = body.zoneName;
            return;
        }
    }

    

    createDatabaseObject() {
        const out = {};
        // Initialize our object with default values for all the keys
        _.forEach(validate.mutualAidNetworkSchema.properties, (attrs, property) => {
            if (this[property] && this[property] !== undefined) {
                out[property] = this[property];
                return;
            }
            switch (attrs.type) {
                case "string":
                    out[property] = '';
                    break;
                case "integer":
                    out[property] = 0;
                    break;
                case "number":
                    out[property] = 0;
                    break;
                case "array":
                    out[property] = [];
                    break;
                case "boolean":
                    out[property] = false;
                    break;
            }
        })

        if (!out.id || out.id.length === 0) {
            // out.id = firebase.ref('events').push().key;
        }
        return out;
    }
}

module.exports = MutualAidNetwork;