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
	var rotationClass = "";

	var turnedEdge = function(dir){
		// return which edge we would be reading from IF the tile 
		// were to be rotated once clockwise
		return ({
			east: "north",
			south: "east",
			west: "south",
			north: "west"
		})[dir];
	};

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

		getRotationClass: function(){
			return rotationClass;
		},

		rotate: function(turns){
			if(turns == 0){ 
				return;
			}
			if(turns == 1 || turns==2 || turns==3) {
				rotationClass = "r" + turns;
			} else {
				throw "invalid rotation";
			}

			for(var i = 0; i < turns; i++){
				//
				// shuffle the edges clockwise
				//
				var n = this.edges.north;
				var e = this.edges.east;
				var s = this.edges.south;
				var w = this.edges.west;
				this.edges.east = n;
				this.edges.south = e;
				this.edges.west = s;
				this.edges.north = w;
			}
		},

		connectableTo: function(inDirection, otherTile, turns){
			//
			// does otherTile match this tile at connecting edge of inDirection?
			//
			var dir = inDirection;
			if(turns > 0){
				for(var i = 0; i < turns; i++){
					dir = turnedEdge(dir);
				}
			}
			//
			// consider this potentially-rotated edge @ dir against some placed edge
			//
			var thisEdge = this.edges[dir];
			var otherEdge = otherTile.edges[{
				north:"south",
				east:"west",
				south:"north",
				west:"east"
			}[inDirection]];
			return thisEdge === otherEdge;
		},

		toJSON: function(){
			return JSON.stringify({
				imageName: imageName,
				north: this.edges.north,
				south: this.edges.south,
				west: this.edges.west,
				east: this.edges.east,
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

	var maxcol = 72;
	var mincol = 72;
	var maxrow = 72;
	var minrow = 72;

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
    for(var row = minrow - 1; row < maxrow + 1; row++){
      for(var col = mincol - 1; col < maxcol + 1; col++){

				if(typeof(world[row][col])==='undefined'){

					// this is an empty slot. See if we can place a tile here
					
					//
					// try 0 to 3 turns for each tile (TODO: cull turns that yield equal tiles)
					//
					for(var turns = 0; turns < 4; turns++){
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
								if(tile.connectableTo(adj[2], otherTile, turns)){
									valids++;
								} else {
									invalids++;
								}
							}
						});

						if(valids > 0 && invalids === 0){
							// store location, rotation, and number of connected edges
							// we can use the number of connected edges later for 
							// optimal placement and hole-filling
							candidateLocations.push([row, col, turns, valids]);
						}
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

			// if we have rotation, apply rotation now
			if(placementLocation[2] != 0){
				tile.rotate(placementLocation[2]);
			}

			placeTile(placementLocation[0], placementLocation[1], tile);
			maxrow = Math.max(maxrow, placementLocation[0]);
			minrow = Math.min(minrow, placementLocation[0]);
			maxcol = Math.max(maxcol, placementLocation[1]);
			mincol = Math.min(mincol, placementLocation[1]);

		} else {
			// uh oh.. we have to throw this tile out
		}
	});

	console.log("Generated world in ", ((new Date()).getTime() - startTime), "ms" );

	return {
		// return extents so that we can render a minimally-sized world
		world: world,
		extents: {
			maxrow: maxrow,
			maxcol: maxcol,
			minrow: minrow,
			mincol: mincol
		}
	};
};


function drawWorld(worldObject){
	var world = worldObject.world;
	var extents = worldObject.extents;
	
	var startTime = (new Date()).getTime();

	var table = $("<table><tbody></tbody></table>");
	tbody = table.find("tbody");

	for(var row = extents.minrow; row < extents.maxrow + 1; row++){
		var tr = $("<tr></tr>");
		for(var col = extents.mincol; col < extents.maxcol + 1; col++){
			var td;
			if(typeof(world[row][col])=='undefined'){
				td = $("<td></td>");
			} else {
				td = $("<td><img src='img/" + world[row][col].getImage() + "' class='" + world[row][col].getRotationClass() + "' /></td>");
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
