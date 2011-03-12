//
// Simple Carcassonne Random Map Generator
// Copyright 2011 Maciej Adwent
//

var EDGE_TYPE_CITY = "city";
var EDGE_TYPE_GRASS = "grass";
var EDGE_TYPE_ROAD = "road";


var edgeDefs = {
	"r":EDGE_TYPE_ROAD,
	"g":EDGE_TYPE_GRASS,
	"c":EDGE_TYPE_CITY
};


var Tile = function(imageName, north, east, south, west, hasTwoCities){
	return {
		edges: {
			north: north,
			east: east,
			west: west,
			south: south
		},

		getImage: function(){
			return imageName;
		},

		connectableTo: function(inDirection, otherTile){
			//
			// does otherTile match this tile at connecting edge of inDirection?
			//
			return this.edges[inDirection] === otherTile.edges[{
				north:"south",
				east:"west",
				south:"north",
				west:"east"
			}[inDirection]];
		},

		toJSON: function(){
			return JSON.stringify({
				imageName: imageName,
				north: north,
				south: south,
				west: west,
				east: east,
				hasTwoCities: hasTwoCities
			});
		}
	};
};


function generateRandomWorld(){
	// Warning: big ugly function ahead. Split up for fun and profit
	
	var startTime = (new Date()).getTime();
	
	var tiles = [];

	var tileDefinitions = _([
		//
		// order of edge specs is NESW
		//
		"city4.png	1	reg	cccc",
		"road4.png	1	reg	rrrr",
		"city3.png	3	reg	ccgc",
		"city3s.png	1	reg	ccgc",
		"city3r.png	1	reg	ccrc",
		"city3sr.png	2	reg	ccrc",
		"road3.png	4	reg	grrr",
		"city2we.png	1	reg	gcgc",
		"city2wes.png	2	reg	gcgc",
		"road2ns.png	8	reg	rgrg",
		"city2nw.png	3	reg	cggc",
		"city2nws.png	2	reg	cggc",
		"city2nwr.png	3	reg	crrc",
		"city2nwsr.png	2	reg	crrc",
		"road2sw.png	9	reg	ggrr",
		"city11ne.png	2	reg	ccgg	11",
		"city11we.png	3	reg	gcgc	11",
		"cloisterr.png	2	reg	ggrg",
		"cloister.png	4	reg	gggg",
		"city1.png	5	reg	cggg",
		"city1rse.png	3	reg	crrg",
		"city1rsw.png	3	reg	cgrr",
		"city1rswe.png	3	reg	crrr",
		"city1rwe.png	4	start	crgr"
	]).chain().map(function(s) {

		return s.split("\t");

	}).map(function(item) {

		var edges = item[3].split("");

		// This is a tile object
		return {
			img: item[0],
			north: edgeDefs[edges[0]],
			east: edgeDefs[edges[1]],
			south: edgeDefs[edges[2]],
			west: edgeDefs[edges[3]],
			isStart: (item[2]=="start"),
			hasTwoCities: item[4]==="11",
			count: parseInt(item[1])
		};

	}).sortBy(function(item){

		// make sure the starter is at the end
		return item.isStart;

	}).each(function(tileDef){

		for(var i = 0; i < tileDef.count; i++){
			tiles.push(new Tile(
				tileDef.img,
				tileDef.north,
				tileDef.east,
				tileDef.south,
				tileDef.west,
				tileDef.hasTwoCities
			));
		}

	});

	//
	// Sort the tiles randomly
	//
	var starterTile = tiles.pop();
	tiles = _(tiles).sortBy(function(tile){ return Math.random(); });
	tiles = [starterTile].concat(tiles);

	//
	// Create world as (72 * 2) x (72 * 2) matrix
	// [   col   col
	//  [ tile, tile .. ],  row
	//  [ tile, tile .. ],  row
	// ]
	//
	var world = new Array(tiles.length * 2);
	for(var i = 0; i < world.length; i++){
		world[i] = new Array(tiles.length * 2);
	}

	function placeTile(row, col, tile){
		world[row][col] = tile;
	};

	// bootstrap tile is placed in the middle.
	placeTile(72,72,tiles[0]);

	//
	// Build the world outwards in carcassone style by building lists 
	// of compatible locations and then choosing one randomly.
	// if the compatible location list is empty for a given tile,
	// we toss that tile out.
	//
	_(tiles).each(function(tile, i){

		// ignore the starter tile because we already placed it.
		if(i==0){
			return;
		}

		//
		// For actual game simulation:
		//
		// TODO: round robin through players
		// TODO: place meeple
		// TODO: account for farms.. road networks.. city networks.. cloisters
		//

		var adjacents = _([
			[-1,0,"north"], // up one row
			[1,0,"south"], // down one row
			[0,-1,"west"], // left one column
			[0,1,"east"] // right one column
		]);

		var candidateLocations = [];

		//
		// scan everywhere in the world with padding of 1 tile
		//
		// TODO: employ a bounding box keeping track of extents to improve performance
		//
		for(var row = 1; row < world.length - 1; row++){
			for(var col = 1; col < world[row].length - 1; col++){

				if(typeof(world[row][col])=='undefined'){

					// this is an empty slot. See if we can place a tile here

					var valids = 0;
					var invalids = 0;

					//
					// try each adjacent. A valid candidate will have 
					// valids > 0 and invalids == 0
					//
					adjacents.each(function(adj){
						var otherTile = world[row + adj[0]][col + adj[1]];
						//
						// is there a tile here? if empty, that doesn't contribute to invalids
						//
						if(typeof(otherTile)!=='undefined'){
							//
							// TODO: try each tile rotation
							//
							if(tile.connectableTo(adj[2], otherTile)){
								valids++;
							} else {
								invalids++;
							}
						}
					});

					if(valids > 0 && invalids === 0){
						candidateLocations.push([row, col]);
					}

				} else {
					// This spot is taken. Ignore
				}
			}
		}

		//
		// Choose a random candidate location and place the tile there.
		//
		if(candidateLocations.length > 0){
			var candidateIndex = Math.round(Math.random() * (candidateLocations.length - 1));
			var placementLocation = candidateLocations[candidateIndex];
			placeTile(placementLocation[0], placementLocation[1], tile);
		} else {
			// uh oh.. we have to throw this tile out
		}
	});

	console.log("Generated world in ", ((new Date()).getTime() - startTime), "ms" );
	return world;
};


function drawWorld(world){
	var startTime = (new Date()).getTime();

	var table = $("<table><tbody></tbody></table>");
	tbody = table.find("tbody");

	for(var row = 0; row < world.length; row++){
		var tr = $("<tr></tr>");
		for(var col = 0; col < world[row].length; col++){
			var td;
			if(typeof(world[row][col])=='undefined'){
				td = $("<td></td>");
			} else {
				//
				// TODO: support tile rotation
				//
				td = $("<td><img src='img/" + world[row][col].getImage() + "' /></td>");
			}
			tr.append(td);
		}
		tbody.append(tr);
	}

	$("body").append(table); 

	console.log("Rendered world in ", ((new Date()).getTime() - startTime), "ms" );
};


//
// In-browser bootstrap
//
$(function(){

	var world = generateRandomWorld();
	drawWorld(world);

});
