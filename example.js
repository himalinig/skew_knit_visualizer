
const canvas = document.getElementById("drawing");
const ctx = canvas.getContext('2d');

class Box {
	constructor(width, height, ports = []) {
		this.width = width;
		this.height = height;
		this.ports = ports;
		this.x = 0;
		this.y = 0;
	}
}

class Knit extends Box {
	constructor() {
		super(0.9, 0.8, [
			{x:-0.45, y:0.0, tx:-0.55, ty:0.0, other:null, otherPort:-1},
			{x: 0.45, y:0.0, tx:0.55, ty:0.0, other:null, otherPort:-1},
			{x: 0.0, y:-0.4, other:null, otherPort:-1},
			{x: 0.0, y:0.4, other:null, otherPort:-1},
		]);
	}
}

//all stitches in construction order:
const allStitches = [];

//all yarns between stitches:
const bridges = [];

//also sorted by needle:
const frontNeedles = [];
const backNeedles = [];

for (let i = 0; i < 6; ++i) {
	frontNeedles.push([]);
	backNeedles.push([]);
}

//---------------
//make some test geometry:

let lastStitch = null;
let lastStitchOut = -1;

//helper -- connect boxes:
function connect(a, aPort, b, bPort) {
	if (typeof aPort !== 'number') throw new Error("aPort should be a port index");
	if (typeof bPort !== 'number') throw new Error("bPort should be a port index");

	if (a.ports[aPort].other !== null) throw new Error("a[aPort] already connected");
	if (b.ports[bPort].other !== null) throw new Error("b[bPort] already connected");

	a.ports[aPort].other = b;
	a.ports[aPort].otherPort = bPort;
	b.ports[bPort].other = a;
	b.ports[bPort].otherPort = aPort;
}

//helper -- make a knit:
function knit(dir, bed, index) {
	if (!(dir === '+' || dir === '-')) throw new Error("direction should be '+' or '-'.");
	const stitch = new Knit();

	stitch.x = 1.0 * index;
	stitch.y = 0.5 * stitch.height;

	//figure out which side needs to connect:
	let stitchIn = 0;
	let stitchOut = 1;
	if (dir === '-') {
		[stitchIn, stitchOut] = [stitchOut, stitchIn];
	}

	if (lastStitch !== null) {
		//connect yarn between last stitch and this stitch:
		connect(lastStitch, lastStitchOut, stitch, stitchIn);

		//also track this as a "bridge" because it goes between the beds:
		bridges.push({
			from:lastStitch, fromPort:lastStitchOut,
			to:stitch, toPort:stitchIn,
			track:1 //yarn carrier track, I guess
		});
	}

	//add stitch to proper columns:
	if (bed === 'f') {
		frontNeedles[index].push(stitch);
	} else if (bed === 'b') {
		backNeedles[index].push(stitch);
	}

	allStitches.push(stitch);

	//remember yarn carrier position:
	lastStitch = stitch;
	lastStitchOut = stitchOut;
}

knit('+', 'f', 1);
knit('+', 'f', 2);
knit('+', 'f', 3);
knit('-', 'f', 3);
knit('-', 'f', 1);
knit('+', 'f', 2);
knit('+', 'f', 4);

//---------------

function draw() {
	const width = canvas.width;
	const height = canvas.height;
	ctx.setTransform(1,0, 0,1, 0,0);
	ctx.fillStyle = "#fff";
	ctx.fillRect(0,0, width,height);

	const scale = 40.0;
	ctx.setTransform(scale,0, 0,-scale, 0.5 * width - scale * (0.5 * (frontNeedles.length-1)), 0.5 * height);

	ctx.lineWidth = 0.02;
	ctx.strokeStyle = '#880';
	ctx.beginPath();
	ctx.moveTo(-0.5, 0.0);
	ctx.lineTo(frontNeedles.length - 0.5, 0.0);
	ctx.stroke();

	const drawNeedles = (needles) => {
		for (let column of needles) {
			for (let box of column) {
				ctx.strokeRect(box.x - 0.5 * box.width, box.y - 0.5 * box.height, box.width, box.height);
			}
		}
	};
	ctx.lineWidth = 0.02;
	ctx.strokeStyle = '#000';
	drawNeedles(backNeedles);
	ctx.strokeStyle = '#888';
	drawNeedles(frontNeedles);

	for (let bridge of bridges) {
		const fromX = bridge.from.x + bridge.from.ports[bridge.fromPort].x;
		const fromY = bridge.from.y + bridge.from.ports[bridge.fromPort].y;
		const fromTX = bridge.from.x + bridge.from.ports[bridge.fromPort].tx;
		const fromTY = bridge.from.y + bridge.from.ports[bridge.fromPort].ty;
		const toX = bridge.to.x + bridge.to.ports[bridge.toPort].x;
		const toY = bridge.to.y + bridge.to.ports[bridge.toPort].y;
		const toTX = bridge.to.x + bridge.to.ports[bridge.toPort].tx;
		const toTY = bridge.to.y + bridge.to.ports[bridge.toPort].ty;

		let midX = 0.5 * (fromX + toX);
		let midY = 0.5 * (fromY + toY);
		let midTX = 0.5 * (fromTX + midX);
		let midTY = 0.5 * (fromTY + midY);

		midX -= 0.1;
		midY += 0.1;
		midTX -= 0.1;
		midTY += 0.1;

		ctx.beginPath();
		ctx.moveTo(fromX, fromY);
		//ctx.bezierCurveTo(fromTX, fromTY, toTX, toTY, toX, toY);
		ctx.bezierCurveTo(fromTX, fromTY, midTX, midTY, midX, midY);
		midTX = 2 * midX - midTX;
		midTY = 2 * midY - midTY;
		ctx.bezierCurveTo(midTX, midTY, toTX, toTY, toX, toY);
		ctx.strokeStyle = '#088';
		ctx.stroke();
	}
}

function step() {
	//every stitch tries to move to minimize port y-offsets:
	for (let box of allStitches) {
		let dy = 0;
		for (let port of box.ports) {
			if (port.other !== null) {
				const otherY = port.other.y + port.other.ports[port.otherPort].y;
				const boxY = box.y + port.y;
				dy += otherY - boxY;
			}
		}
		box.y += 0.5 * dy;
	}
	//but also (stitch) columns enforce collision:
	const doNeedles = (needles) => {
		for (let column of needles) {
			if (column.length === 0) continue;

			//pin last stitch to the top of the column in stitch columns:
			const top = column[column.length-1];
			top.y = -0.5 * top.height;

			//shove stitches apart:
			for (let i = column.length - 2; i >= 0; --i) {
				const above = column[i+1];
				const below = column[i];
                console.log("hello")
				const gap = (above.y - 0.5 * above.height) - (below.y + 0.5 * below.height);
				if (gap < 0) {
					above.y -= 0.5 * gap;
					below.y += 0.5 * gap;
				}
			}
		}
	};
	for (let iter = 0; iter < 10; ++iter) {
		doNeedles(backNeedles);
		doNeedles(frontNeedles);
	}

	//show new positions:
	draw();
	window.requestAnimationFrame( step );
}

window.requestAnimationFrame( step );