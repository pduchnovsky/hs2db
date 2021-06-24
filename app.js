const moment = require('moment')
const pg = require('pg')
const format = require('pg-format')
const fetch = require('node-fetch')
const hubspotApi = require('@hubspot/api-client')

/* Variables & Secrets */
const hubspot = {
	apikey: process.env._hs_apikey,
	url: process.env._hs_url
}
const db = {
	host: process.env._db_host,
	port: process.env._db_port,
	user: process.env._db_user,
	password: process.env._db_password,
	database: process.env._db_database,
}

const getData = async (hubspot, qstart, qend, after = 0) => {
	const hubspotClient = new hubspotApi.Client({apiKey: hubspot.apikey})
	const filterGroup = {
		filters: [
			{propertyName: 'closedate', operator: 'GTE', value: qstart.valueOf()},
			{propertyName: 'closedate', operator: 'LTE', value: qend.valueOf()},
			{propertyName: 'amount', operator: 'GT', value: 0},
		],
	}
	const sort = JSON.stringify({propertyName: 'closedate', direction: 'DESCENDING'})
	const response = await hubspotClient.crm.deals.searchApi.doSearch({
		filterGroups: [filterGroup],
		sorts: [sort],
		limit: 100,
		after,
	})
	return response.body
}

const dbQuery = async (query) => {
	const pgClient = new pg.Pool({
		host: db.host,
		port: db.port,
		user: db.user,
		password: db.password,
		database: db.database,
	})

	console.log('Making DB Query')
	await pgClient.query(query)
	await pgClient.end()
	console.log('Results written to database')
}

(async function () {
	/* apiCall - get deals */
	console.log('Making API Call')
	const stagesapi = await fetch(hubspot.url + hubspot.apikey)
	const stagesdata = await stagesapi.json()
	const stages = stagesdata.results[0].stages

	let qoffset = -7

	const qstart = moment()
		.quarter(moment().quarter() + qoffset)
		.startOf('quarter')
	const qend = moment()
		.quarter(moment().quarter())
		.endOf('quarter')

	let apiresponse = await getData(hubspot, qstart, qend)
	let apiresults = apiresponse.results
	while (apiresponse.paging != undefined) {
		let after = apiresponse.paging.next.after
		apiresponse = await getData(hubspot, qstart, qend, after)
		apiresults = apiresults.concat(apiresponse.results)
	}

	/* process data from API per quarter */
	const quarters = {}

	while (qoffset <= 0) {
		const results = {}
		const quarterStart = moment()
			.quarter(moment().quarter() + qoffset)
			.startOf('quarter')
			.toISOString()
		const quarterEnd = moment()
			.quarter(moment().quarter() + qoffset)
			.endOf('quarter')
			.toISOString()
		apiresults.forEach(deal => {
			if (
				deal.properties.dealstage != 'closedlost' &&
				deal.properties.closedate >= quarterStart &&
				deal.properties.closedate <= quarterEnd
			) {
				let dealstage = stages
					.filter(item => item.stageId === deal.properties.dealstage)
					.map(item => item.label)
				if (results[dealstage] === undefined) {
					results[dealstage] = {amount: 0, count: 0}
				}
				results[dealstage].count += 1
				results[dealstage].amount += +deal.properties.amount
			}
		})
		quarters[quarterStart] = results
		qoffset++
	}
	/* prepare query values */
	const queryValues = []
	Object.entries(quarters).forEach(([qdate, results]) => {
		Object.entries(results).forEach(([key, value]) => {
			queryValues.push([qdate, key, value.amount, value.count])
		})
	})

	/* push data to database */
	if (queryValues.length > 0) {
		const query = format(
			'DROP TABLE deals;CREATE TABLE deals (qstart TIMESTAMP NOT NULL,dealstage VARCHAR ( 50 ) not null,amount NUMERIC not null,count NUMERIC not null);GRANT SELECT ON TABLE deals TO db;INSERT INTO deals(qstart, dealstage, amount, count) VALUES %L RETURNING *',
			queryValues
		)
		await dbQuery(query)
	} else {
		console.error('Error: Empty queryValues array')
	}
})()
.catch(e => {
	console.log(e);
});
