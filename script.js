

// From here in I use P2,P3 to create 2D and 3D points
const P3 = (x = 0, y = 0, z = 0) => ({x,y,z});
const P2 = (x = 0, y = 0) => ({ x, y});
const pointAverage = (p1, p2) => ({x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 , z: (p1.z + p2.z) / 2});
const D2R = (ang) => (ang-90) * (Math.PI/180 );
const Ang2Vec = (ang,len = 1) => P2(Math.cos(D2R(ang)) * len,Math.sin(D2R(ang)) * len);
const projTypes = {
  Isometric : {
    xAxis : Ang2Vec(120) ,
    yAxis : Ang2Vec(-120) ,
    zAxis : Ang2Vec(0) ,
  }
}

const axoProjMat = {
  xAxis : P2(1 , 0) ,
  yAxis :  P2(-1 , 0) ,
  zAxis :  P2(0 , -1) ,
  depth :  P3(0,0,1) , // projections have z as depth
  origin : P2(450,65), // (0,0) default 2D point
  setProjection(name){
    if(projTypes[name]){
      Object.keys(projTypes[name]).forEach(key => {
        this[key]=projTypes[name][key];
      })

      if(!projTypes[name].depth){
        this.depth = P3(
          this.xAxis.y,
          this.yAxis.y,
          -this.zAxis.y
        );
      }

    }
  },
  project (p, retP = P3()) {
      retP.x = p.x * this.xAxis.x + p.y * this.yAxis.x + p.z * this.zAxis.x + this.origin.x;
      retP.y = p.x * this.xAxis.y + p.y * this.yAxis.y + p.z * this.zAxis.y + this.origin.y;
      retP.z = p.x * this.depth.x + p.y * this.depth.y + p.z * this.depth.z; 
      return retP;
  }
}
axoProjMat.setProjection("Isometric");



class Needle {
    constructor(number, bed){
        this.y = number;
        this.x = bed;
        this.z = 0;
        this.topLeft = P3(this.x, this.y, this.z);
        this.bottomLeft = P3(this.x + 1, this.y, this.z);
        this.bottomRight = P3(this.x + 1, this.y - 1, this.z);
        this.topRight = P3(this.x, this.y - 1, this.z);
        this.cells = [];
        this.newCellOps = [Knit];
        this.additionalOps = [Tuck];
        
    }
    addOp(op){
        var retCell = null;
        if(this.cells.length == 0){
            var cell = new NeedleCell(op, this.x + 0.5, this.y, this.z);
            retCell = cell;
            this.cells.push(cell);
        } else {
            var makeNewCell = this.newCellOps.some(newOp => op instanceof newOp);
            var addToOldCell = this.additionalOps.some(additionalOp => op instanceof additionalOp)
            if(makeNewCell){
                var newCell = new NeedleCell(op, this.x  + 0.5, this.y, this.z);
                this.cells.forEach(cell => cell.pushDown());
                this.cells.push(newCell);
                retCell = newCell;
            } else if(addToOldCell){
                var oldCell = this.cells.pop();
                oldCell.addOp(op);
                this.cells.push(oldCell);
                retCell = oldCell;
            }
        }
        return retCell;
    }
    render(grid){
        grid.Rect(this.topLeft, this.bottomLeft, this.bottomRight, this.topRight, this.y.toString());
    }
    renderStack(grid){
        this.cells.forEach(cell => cell.render(grid));

    }
}
class NeedleCell {
    constructor(op, x, y, z){
        this.ops = [op];
        this.opNames = op.getName();
        
        this.topLeft = P3(x, y - 0.1, z - 0.1);
        this.bottomLeft = P3(x, y - 0.1, z - 0.9);
        this.bottomRight = P3(x, y - 0.9, z - 0.9);
        this.topRight = P3(x, y - 0.9, z - 0.1);
        this.getLeftPort = () => P3(this.topLeft.x, this.topLeft.y, this.topLeft.z - 0.4);
        this.getRightPort = () => P3(this.topRight.x, this.topRight.y, this.topRight.z - 0.5);
    }
    addOp(op){
        this.opNames += ", " + op.getName(); 
    }
    pushDown(){
        this.bottomRight.z -= 1;
        this.bottomLeft.z -= 1;
        this.topLeft.z -= 1;
        this.topRight.z -= 1;
    }
   
    render(grid){
        grid.Rect(this.topLeft, this.bottomLeft, this.bottomRight, this.topRight,  this.opNames);
        var lines = this.ops.map(op => op.getStroke(this.topLeft, this.bottomLeft, this.bottomRight, this.topRight,));
        var temp = lines.flat(1);
        temp.map(line => grid.addLine(line))
    }

}
class Carrier {
    constructor(){
        const origin = () => P3(0, 0, 0);
        this.carrierLocation = origin;
        this.yarnCrossings = [];
    }
    addCrossing(p1, p2){
        this.yarnCrossings.push({
            p1: p1, 
            p2: p2
        });
    }
    updateCarrierLocation(location){
        this.carrierLocation = location;
    }
    getCarrierLocation(){
        return this.carrierLocation;
    } 
    render(grid){
        this.yarnCrossings.forEach(crossing => grid.addLine([crossing.p1(), crossing.p2()]));
    }
}
class Machine {
    constructor(ctx){
        this.ctx = ctx;
        this.grid = new Grid(this.ctx);
        this.carriers = [];
        this.defaultStyles = [];
        this.ops = [];
        this.frontbed = {};
        this.backbed = {};
        this.styles = {};

    }
    setCarriers (carriers){
        return;
      
        // console.assert(this.carriers.length === 0, "Shouldn't set carriers twice.");

        // var colors = [
        //     {color: '#ff4d00'},
        //     {color: '#00b2ff'},
        //     {color: '#ffe500'},
        //     {color: '#0019ff'},
        //     {color: '#80ff00'},
        //     {color: '#8000ff'},
        //     {color: '#00ff19'},
        //     {color: '#ff00e6'},
        //     {color: '#00ffb3'},
        //     {color: '#ff004d'},
        // ]

        // carriers.forEach(function(c,ci){
        //     this.carriers.push({name:c, index:ci});
        //     this.styles[c] = colors[ci];
        // }, this);
        // this.defaultStyles = this.styles;
      
    }
    addOP(op) {
        this.ops.push(op);
    }
    runMachine(){

        for(var i = 0; i < this.ops.length; i++){
            var op = this.ops[i];
            if(op.needleOp){
                if(op.needle.bed === 'f' || op.needle.bed === 'fs'){
                
                    this.frontbed[op.needle.number] = new Needle(op.needle.number, 0);

                } else{
                    this.backbed[op.needle.number] = new Needle(op.needle.number, -1);
                }
            }
        }
        var carrier = new Carrier(this.ctx, this.grid);
        var cell = null;
        for(var i = 0; i < this.ops.length; i++){
            var op = this.ops[i];
            
            if(op.needleOp){
                if(op.needle.bed === 'f' || op.needle.bed === 'fs'){
                    cell = this.frontbed[op.needle.number].addOp(op );
                }
                else{
                    cell = this.backbed[op.needle.number].addOp(op);
                }
                if(op.direction == '-'){
                    carrier.addCrossing(carrier.getCarrierLocation(), cell.getLeftPort);
                    carrier.updateCarrierLocation(cell.getRightPort);
                } else {
                    carrier.addCrossing(carrier.getCarrierLocation(), cell.getRightPort);
                    carrier.updateCarrierLocation(cell.getLeftPort);

                }
            }
            

        }
        this.carriers.push(carrier);

    }
    renderMachine(){
        this.carriers.forEach(carrier => carrier.render(this.grid));
        for (let needle in this.frontbed) {
            this.frontbed[needle].render(this.grid);
            this.frontbed[needle].renderStack(this.grid);
        }
        for (let needle in this.backbed) {
            this.backbed[needle].render(this.grid);
            this.backbed[needle].renderStack(this.grid);
        }
        this.grid.render();
    }

}

class Operator {
    constructor(name, needleOp=true) {
        this.direction;
        this.rackingValue;
        this.needle;
        this.carrierSet;
        this.needle2;
        this.carrierTarget;
        this.name = name;
        this.needleOp = needleOp;
    }
    getName(){
        return this.name;
    }
}

class In extends Operator{
    constructor(carrierSet) {
        super("in", false);

        this.carrierSet = carrierSet;
    }
}

class Inhook extends Operator {
    constructor(carrierSet) {
        super("inhook", false);
        this.carrierSet = carrierSet;
    }
}
class Releasehook extends Operator {
    constructor(carrierSet) {
        super("releasehook", false);
        this.carrierSet = carrierSet;
    }
}


class Tuck extends Operator {
    constructor(direction, needle, carrierSet) {
        super("tuck");
        this.direction = direction;
        this.needle = needle;
        this.carrierSet = carrierSet;
    }
    getStroke(topLeft, bottomLeft, bottomRight, topRight){
        var width = Math.abs(bottomRight.y - bottomLeft.y);
        var height = Math.abs(bottomRight.z - topRight.z);
        var wGap = width * 0.2;
        var hGap = height * 0.3;
        var midTop = pointAverage(topLeft, topRight);
        var midLeft = pointAverage(topLeft, bottomLeft);
        var midRight = pointAverage(bottomRight, topRight);

        var midTopLeft = {
            x: midTop.x,
            y: midTop.y + wGap,
            z: midTop.z
        }
        var midTopRight = {
            x: midTop.x,
            y: midTop.y - wGap,
            z: midTop.z
        }
        var innerTopLeft = {
            x: topLeft.x, 
            y: topLeft.y - wGap,
            z: topLeft.z - hGap,
        }
        var innerTopRight = {
            x: topRight.x, 
            y: topRight.y + wGap,
            z: topRight.z - hGap,
        }

        var vertices = [[midLeft,innerTopLeft,  midTopLeft],[midRight, innerTopRight, midTopRight]];
        // var vertices = [[midRight, innerTopRight, midTopRight]];
        return vertices;
    }
}
class Knit extends Operator {
    constructor(direction, needle, carrierSet) {
        super("knit");
        this.direction = direction;
        this.needle = needle;
        this.carrierSet = carrierSet;
    }

    getStroke(topLeft, bottomLeft, bottomRight, topRight){
        var width = Math.abs(bottomRight.y - bottomLeft.y);
        var height = Math.abs(bottomRight.z - topRight.z);
        var wGap = width * 0.15;
        var hGap = height * 0.15;
        var midBottom = pointAverage(bottomLeft, bottomRight);
        var midTop = pointAverage(topLeft, topRight);
        var midLeft = pointAverage(topLeft, bottomLeft);
        var midRight = pointAverage(bottomRight, topRight);
        var midTopLeft = {
            x: midTop.x,
            y: midTop.y + wGap,
            z: midTop.z
        }
        var midTopRight = {
            x: midTop.x,
            y: midTop.y - wGap,
            z: midTop.z
        }
    
        var midBottomLeft = {
            x: midBottom.x,
            y: midBottom.y + wGap,
            z: midBottom.z
        }
        var midBottomRight = {
            x: midBottom.x,
            y: midBottom.y - wGap,
            z: midBottom.z
        }
        var innerTopLeft = {
            x: topLeft.x, 
            y: topLeft.y - wGap,
            z: topLeft.z - hGap,
        }
        var innerTopRight = {
            x: topRight.x, 
            y: topRight.y + wGap,
            z: topRight.z - hGap,
        }
        var innerBottomLeft = {
            x: bottomLeft.x, 
            y: bottomLeft.y - wGap,
            z: bottomLeft.z + hGap,
        }
        var innerBottomRight = {
            x: bottomRight.x, 
            y: bottomRight.y + wGap,
            z: bottomRight.z + hGap,
        }
        var leftInnerCorner = {
            x: midBottomLeft.x,
            y: midBottomLeft.y,
            z: innerBottomLeft.z,

        }
        var rightInnerCorner = {
            x: midBottomRight.x,
            y: midBottomRight.y,
            z: innerBottomRight.z,
            
        }
        var topLeftInnerCorner = {
            x: midLeft.x,
            y: midTopLeft.y,
            z: midLeft.z,

        }
        var topRightInnerCorner = {
            x: midRight.x,
            y: midTopRight.y,
            z: midRight.z,

        }
        var leftTuck = [
            midLeft,
            topLeftInnerCorner,
            midTopLeft
        ]
        var rightTuck = [
            midRight, 
            topRightInnerCorner,
            midTopRight
        ]

        var vertices = [
            [midBottomLeft, leftInnerCorner, innerBottomLeft, innerTopLeft, innerTopRight, innerBottomRight, rightInnerCorner, midBottomRight],
            leftTuck,
            rightTuck
        ];
        return vertices;

    }
}


class Grid {
    constructor(ctx){
        this.ctx = ctx
        this.unitWidth = 50;
        this.padding = this.unitWidth * 0.2;
        this.squaresToRender = [];
        this.axes = [];
        this.linesToRender = [];
        this.color = "#" + Math.floor(Math.random()*16777215).toString(16);
 

    }
    addLine(vertices){

        var randomColor = "#" + Math.floor(Math.random()*16777215).toString(16);
        this.linesToRender.push({
            vertices: vertices.map(point => P3(point.x * this.unitWidth, point.y* this.unitWidth, point.z* this.unitWidth)),
            fill: randomColor,
            strokeStyle: "#fff",
        })
    }
    
   
    Rect(topLeft, bottomLeft, bottomRight, topRight, text="default"){
        const scalePoint = (point) => ({x: point.x * this.unitWidth,y: point.y * this.unitWidth,z: point.z * this.unitWidth});
        
        var randomColor = "#" + Math.floor(Math.random()*16777215).toString(16);
        this.squaresToRender.push({
            vertices: [scalePoint(topLeft),scalePoint(bottomLeft),scalePoint(bottomRight),scalePoint(topRight), scalePoint(topLeft) ],
            fill: randomColor,
            strokeStyle: "#fff",
            text: text,
        });
    }
    render(){

        this.ctx.clearRect(0, 0,this.ctx.canvas.width, this.ctx.canvas.height);
  

        this.squaresToRender.forEach(square => {
            this.ctx.fillStyle = square.fill;
            this.ctx.globalAlpha = 0.4;

            this.ctx.strokeStyle = square.fill;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            const projVertices = square.vertices.map(vertex => axoProjMat.project(vertex));
            projVertices.forEach((vertex, index) => {
                this.ctx.lineTo(vertex.x , vertex.y)
                // this.ctx.strokeText(index.toString(), vertex.x , vertex.y)
            });
            
            this.ctx.stroke();
            this.ctx.fill();
            this.ctx.globalAlpha = 1.0;
            // this.ctx.strokeText(square.text, projVertices[1].x, projVertices[1].y);

            
        });

        this.linesToRender.forEach((line, index) => {
            // this.ctx.globalAlpha = 0.0;
            this.ctx.strokeStyle = line.fill;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            const projVertices = line.vertices.map(vertex => axoProjMat.project(vertex));
            projVertices.forEach((vertex, index) => {
                // this.ctx.arc(vertex.x , vertex.y, 2, 0, 2 * Math.PI, false)
                this.ctx.lineTo(vertex.x , vertex.y, 2, 0, 2 * Math.PI, false)
                // this.ctx.strokeText(index.toString(), vertex.x, vertex.y);
            });
            // ctx.closePath();
            ctx.stroke();
        })

    }
}

var opClasses = {
    "in": In,
    "inhook": Inhook,
    "releasehook": Releasehook,
    "tuck": Tuck,
    "knit": Knit,
}



var canvas = document.querySelector('canvas');
fitToContainer(canvas);

function fitToContainer(canvas){
  // Make it visually fill the positioned parent
  canvas.style.width ='100%';
  canvas.style.height='100%';
  // ...then set the internal size to match
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}



const ctx = canvas.getContext("2d");



var machine = new Machine(ctx);
parseKnitout(knitout_example, machine, opClasses);


var paragraph = document.getElementById("code-text");
var text = document.createTextNode(knitout_example);

paragraph.appendChild(text);

machine.runMachine();
machine.renderMachine();

