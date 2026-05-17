"use strict";

/*
    Educational clustering project.
    This file is intentionally kept as one piece: data, algorithms, canvas drawing
    and UI all live here, so the full flow can be followed without jumping between modules.
    Sorry for the mess, but it was fun to write and I hope it is fun to read!
*/

/* Shared palette across algorithms: each cluster gets a cyclic color. */
const cluster_color = [
    "#e6194b", "#3cb44b", "#e5c700", "#4363d8", "#f58231", "#911eb4",
    "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff",
    "#9a6324", "#db8707", "#800000", "#aaffc3", "#808000", "#ffd8b1",
    "#000075", "#808080", "#548075", "#e100ff"
];

const pointSize = 4;
const crossSize = 20;

/* Small DOM helpers: they keep the UI code easier to read. */
function DOM(id){
    return document.getElementById(id);
}

function DOMgetValue(id){
    return DOM(id).value;
}

function DOMsetValue(id,value){
    DOM(id).textContent = value;
}

/* Classic Euclidean distance between two canvas points. */
function euclidianDistance(point1,point2){
    let dx = Math.pow(point2.x - point1.x,2);
    let dy = Math.pow(point2.y - point1.y,2);

    return Math.sqrt(dx + dy);
}

function randomBetween(min,max){
    return min + Math.random() * (max - min);
}

/* Keeps a value inside a range: useful to avoid generating points outside the canvas. */
function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
}

function isSamePoint(point1,point2){
    return point1.x === point2.x && point1.y === point2.y && point1.i === point2.i;
}

function isInArray(arr,point){
    return arr.some((element) => isSamePoint(element,point));
}

function isInCluster(arr,point){
    return arr.some((cluster) => {
        return cluster.some((element) => isSamePoint(element,point));
    });
}

function getMaxDist(points,centroid){
    let maxDist = -Infinity;

    for(let point of points){
        let distance = euclidianDistance(point,centroid);

        if(distance > maxDist){
            maxDist = distance;
        }
    }

    return maxDist + 18;
}

/*
    Dataset generators.
    Points decides how many points to create, Spread controls the scale of the shape,
    Noise % controls how far points move away from the ideal distribution.
*/

function generateNoisePoints(count,width,height){
    let margin = 18;
    let points = [];

    for(let i = 0;i < count;i++){
        points.push({
            x: randomBetween(margin,width - margin),
            y: randomBetween(margin,height - margin)
        });
    }

    return points;
}

function generateRandomClusters(clusterCount,totalPoints,spread,noisePercent,width,height){
    let margin = Math.max(36,spread);
    let points = [];
    let noise = spread * (noisePercent / 100) * 1.4;

    for(let i = 0;i < clusterCount;i++){
        /* Each cluster starts from a random center, then receives a share of the total points. */
        let center = {
            x: randomBetween(margin,width - margin),
            y: randomBetween(margin,height - margin)
        };
        let clusterSize = Math.floor(totalPoints / clusterCount);

        if(i < totalPoints % clusterCount){
            clusterSize++;
        }

        for(let j = 0;j < clusterSize;j++){
            /* sqrt(Math.random()) avoids packing too many points near the center. */
            let angle = Math.random() * Math.PI * 2;
            let radius = Math.sqrt(Math.random()) * spread;
            let x = center.x + Math.cos(angle) * radius + randomBetween(-noise,noise);
            let y = center.y + Math.sin(angle) * radius + randomBetween(-noise,noise);

            points.push({
                x: clamp(x,8,width - 8),
                y: clamp(y,8,height - 8)
            });
        }
    }

    return points;
}

function generateTwoMoons(count,width,height,spread,noisePercent){
    let points = [];
    let noise = spread * (noisePercent / 100) * 0.55;
    let radius = Math.min(width,height) * (0.19 + spread / 1500);
    let centerX = width * 0.48;
    let centerY = height * 0.48;
    let firstMoonCount = Math.ceil(count / 2);
    let secondMoonCount = count - firstMoonCount;

    /* First moon: upper arc. */
    for(let i = 0;i < firstMoonCount;i++){
        let t = Math.PI * (i / Math.max(1,firstMoonCount - 1));
        let x = centerX + Math.cos(t) * radius + randomBetween(-noise,noise);
        let y = centerY - Math.sin(t) * radius + randomBetween(-noise,noise);
        points.push({x:clamp(x,8,width - 8),y:clamp(y,8,height - 8)});
    }

    /* Second moon: same arc, flipped and shifted. */
    for(let i = 0;i < secondMoonCount;i++){
        let t = Math.PI * (i / Math.max(1,secondMoonCount - 1));
        let x = centerX + radius * 0.95 - Math.cos(t) * radius + randomBetween(-noise,noise);
        let y = centerY + radius * 0.45 + Math.sin(t) * radius + randomBetween(-noise,noise);
        points.push({x:clamp(x,8,width - 8),y:clamp(y,8,height - 8)});
    }

    return points;
}

function generateConcentricCircles(count,width,height,spread,noisePercent){
    let points = [];
    let center = {x:width / 2,y:height / 2};
    let size = Math.min(width,height);
    let noiseRatio = noisePercent / 100;
    let innerRadius = clamp(size * 0.12 + spread * 0.22,28,size * 0.28);
    let ringGap = size * 0.12 + spread * 0.45;
    let outerRadius = clamp(innerRadius + ringGap,innerRadius + 34,size * 0.43);
    let radialNoise = spread * noiseRatio * 0.45;
    let tangentNoise = spread * noiseRatio * 0.28;
    let angleNoise = noiseRatio * 0.20;
    let firstCircleCount = Math.ceil(count / 2);
    let secondCircleCount = count - firstCircleCount;
    let offset = Math.random() * Math.PI * 2;

    /* Draws a ring with radial and tangential jitter controlled by Noise %. */
    let pushRing = (ringCount,radius,rotation) => {
        for(let i = 0;i < ringCount;i++){
            let slot = (i + Math.random()) / Math.max(1,ringCount);
            let t = offset + rotation + Math.PI * 2 * slot + randomBetween(-angleNoise,angleNoise);
            let ringRadius = radius + randomBetween(-radialNoise,radialNoise);
            let tangent = randomBetween(-tangentNoise,tangentNoise);
            let x = center.x + Math.cos(t) * ringRadius - Math.sin(t) * tangent;
            let y = center.y + Math.sin(t) * ringRadius + Math.cos(t) * tangent;

            points.push({
                x:clamp(x,8,width - 8),
                y:clamp(y,8,height - 8)
            });
        }
    };

    pushRing(firstCircleCount,innerRadius,0);
    pushRing(secondCircleCount,outerRadius,Math.PI / Math.max(8,secondCircleCount));

    return points;
}

function generateSpiral(count,width,height,spread,noisePercent){
    let points = [];
    let center = {x:width / 2,y:height / 2};
    let maxRadius = Math.min(width,height) * 0.22 + spread * 0.75;
    let noise = spread * (noisePercent / 100) * 0.45;

    /* Two opposite arms, so Spectral and DBSCAN get a more interesting dataset. */
    for(let arm = 0;arm < 2;arm++){
        let armCount = Math.floor(count / 2);

        if(arm < count % 2){
            armCount++;
        }

        if(armCount === 0){
            continue;
        }

        for(let i = 0;i < armCount;i++){
            let ratio = i / Math.max(1,armCount - 1);
            let t = ratio * Math.PI * 3.4 + arm * Math.PI;
            let r = ratio * maxRadius;
            let x = center.x + Math.cos(t) * r + randomBetween(-noise,noise);
            let y = center.y + Math.sin(t) * r + randomBetween(-noise,noise);

            points.push({
                x:clamp(x,8,width - 8),
                y:clamp(y,8,height - 8)
            });
        }
    }

    return points;
}

/*
    CanvasHandler only knows how to draw.
    Algorithms prepare the results, this class decides how to show them:
    points, centroids, boundaries, ellipses, MST, dendrograms and visual legends.
*/
class CanvasHandler{
    constructor(canvas){
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.resize();
    }

    resize(){
        let rect = this.canvas.getBoundingClientRect();

        this.canvas.width = Math.max(320,parseInt(rect.width));
        this.canvas.height = Math.max(320,parseInt(rect.height));

        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    reset(){
        this.ctx.clearRect(0,0,this.width,this.height);
    }

    getMouse(event){
        let rect = this.canvas.getBoundingClientRect();

        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    drawPoints(data,color){
        for(let point of data){
            this.ctx.beginPath();
            this.ctx.arc(point.x,point.y,pointSize,0,2 * Math.PI,false);
            this.ctx.fillStyle = color;
            this.ctx.fill();
        }
    }

    drawPointAlpha(point,color,alpha){
        this.ctx.beginPath();
        this.ctx.arc(point.x,point.y,pointSize,0,2 * Math.PI,false);
        this.ctx.fillStyle = this.colorAlpha(color,alpha);
        this.ctx.fill();
    }

    drawCentroids(centroids,color){
        for(let centroid of centroids){
            this.ctx.beginPath();
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1.5;
            this.ctx.moveTo(centroid.x - crossSize / 2,centroid.y);
            this.ctx.lineTo(centroid.x + crossSize / 2,centroid.y);
            this.ctx.moveTo(centroid.x,centroid.y - crossSize / 2);
            this.ctx.lineTo(centroid.x,centroid.y + crossSize / 2);
            this.ctx.stroke();
        }
    }

    drawRadius(x,y,radius,color = "black",lineWidth = 1){
        this.ctx.beginPath();
        this.ctx.arc(x,y,radius,0,2 * Math.PI,false);
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeStyle = color;
        this.ctx.stroke();
    }

    drawLabel(point,text,color = "#111827",font = "12px Arial"){
        this.ctx.fillStyle = color;
        this.ctx.font = font;
        this.ctx.fillText(String(text),point.x + 6,point.y + 12);
    }

    drawSoftLabel(point,text,isActive){
        this.ctx.save();
        this.ctx.font = isActive ? "700 11px Arial" : "10px Arial";
        this.ctx.fillStyle = isActive ? "rgba(17, 24, 39, 0.92)" : "rgba(71, 85, 105, 0.58)";
        this.ctx.fillText(String(text),point.x + 6,point.y + 12);
        this.ctx.restore();
    }

    colorAlpha(hexColor,alpha){
        let raw = hexColor.replace("#","");
        let r = parseInt(raw.slice(0,2),16);
        let g = parseInt(raw.slice(2,4),16);
        let b = parseInt(raw.slice(4,6),16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    drawKMeans(data,centroids,result,showBoundaries){
        this.reset();

        if(!result){
            this.drawPoints(data,"#000000");
            this.drawCentroids(centroids,"#6F1615");
            return;
        }

        if(showBoundaries){
            this.drawKMeansBoundaries(result.centroids);
        }

        for(let [i,cluster] of result.clusters.entries()){
            this.drawPoints(cluster.points,cluster_color[i % cluster_color.length]);
        }

        this.drawCentroids(centroids,"#6F1615");
        this.drawCentroids(result.centroids,"#2d7a22");
    }

    drawKMeansBoundaries(centroids){
        let cellSize = 10;

        for(let y = 0;y < this.height;y += cellSize){
            for(let x = 0;x < this.width;x += cellSize){
                let candidate = 0;
                let minDistance = Infinity;
                let point = {x:x + cellSize / 2,y:y + cellSize / 2};

                for(let [i,centroid] of centroids.entries()){
                    let distance = euclidianDistance(point,centroid);

                    if(distance < minDistance){
                        minDistance = distance;
                        candidate = i;
                    }
                }

                this.ctx.fillStyle = this.colorAlpha(cluster_color[candidate % cluster_color.length],0.12);
                this.ctx.fillRect(x,y,cellSize,cellSize);
            }
        }
    }

    drawSpectral(data,result,showBoundaries){
        this.reset();

        if(!result){
            this.drawPoints(data,"#000000");
            return;
        }

        if(showBoundaries){
            this.drawNearestPointBoundaries(result.clusters);
        }

        for(let [i,cluster] of result.clusters.entries()){
            let color = cluster_color[i % cluster_color.length];
            this.drawPoints(cluster,color);

            if(cluster.length > 0){
                let centroid = this.getCentroid(cluster);
                this.drawLabel(centroid,`S${i + 1}`,"#111827","700 12px Arial");
            }
        }

        this.drawInfo(`Spectral - ${result.phaseLabel || "final clusters"}`);
    }

    drawFuzzy(data,result,showBoundaries){
        this.reset();

        if(!result){
            this.drawPoints(data,"#000000");
            return;
        }

        if(showBoundaries){
            this.drawKMeansBoundaries(result.centroids);
        }

        for(let [i,cluster] of result.clusters.entries()){
            let color = cluster_color[i % cluster_color.length];

            for(let point of cluster){
                let idx = data.indexOf(point);
                let confidence = idx >= 0 ? result.confidence[idx] : 1;
                let alpha = 0.22 + confidence * 0.78;

                this.drawPointAlpha(point,color,alpha);
            }
        }

        this.drawCentroids(result.centroids,"#111827");
        this.drawInfo(`Fuzzy C-Means - iterations: ${result.iterations} - alpha = membership`);
    }

    drawMeanShift(data,result,showDensity,showTrails,showDetails){
        this.reset();

        if(!result){
            this.drawPoints(data,"#000000");
            return;
        }

        if(showDensity){
            /* Topological density map: light bands and KDE contour lines. */
            this.drawMeanShiftDensityMap(data,result);
        }

        if(showTrails && result.trails){
            /* Trails show how points move toward denser areas. */
            this.drawTrails(result.trails,result.assignment,result.clusters);
        }

        for(let [i,cluster] of result.clusters.entries()){
            let color = cluster_color[i % cluster_color.length];
            let isWeak = cluster.length <= 2;

            this.drawPoints(cluster,isWeak ? "#9ca3af" : color);

            if(showDetails && result.modes[i] && !isWeak){
                this.drawRadius(result.modes[i].x,result.modes[i].y,result.bandwidth,this.colorAlpha(color,0.28),1.2);
                this.drawCentroids([result.modes[i]],color);
                this.drawLabel(result.modes[i],`M${i + 1}`,"#111827","700 12px Arial");
            }
        }

        this.drawInfo(`Mean Shift - modes: ${result.modes.length} - weak/noise: ${result.weakCount} - iterations: ${result.iterations}`);
    }

    drawMeanShiftDensityMap(data,result){
        if(!data || data.length === 0 || !result || !result.bandwidth){
            return;
        }

        let cellSize = 14;
        let cols = Math.ceil(this.width / cellSize) + 1;
        let rows = Math.ceil(this.height / cellSize) + 1;
        let bandwidth = Math.max(1,result.bandwidth);
        let sigma2 = 2 * bandwidth * bandwidth;
        let values = [];
        let maxDensity = 0;

        for(let row = 0;row < rows;row++){
            values[row] = [];

            for(let col = 0;col < cols;col++){
                let x = col * cellSize;
                let y = row * cellSize;
                let density = 0;

                for(let point of data){
                    let dx = x - point.x;
                    let dy = y - point.y;
                    density += Math.exp(-(dx * dx + dy * dy) / sigma2);
                }

                density = density / data.length;
                values[row][col] = density;

                if(density > maxDensity){
                    maxDensity = density;
                }
            }
        }

        if(maxDensity <= 0){
            return;
        }

        this.drawMeanShiftDensityBands(values,maxDensity,cellSize);
        this.drawMeanShiftContourLines(values,maxDensity,cellSize);
    }

    drawMeanShiftDensityBands(values,maxDensity,cellSize){
        let bands = [
            {limit:0.18,color:"rgba(59, 130, 246, 0.045)"},
            {limit:0.32,color:"rgba(20, 184, 166, 0.060)"},
            {limit:0.50,color:"rgba(34, 197, 94, 0.075)"},
            {limit:0.68,color:"rgba(234, 179, 8, 0.090)"},
            {limit:0.84,color:"rgba(249, 115, 22, 0.105)"},
            {limit:1.01,color:"rgba(220, 38, 38, 0.120)"}
        ];

        for(let row = 0;row < values.length - 1;row++){
            for(let col = 0;col < values[row].length - 1;col++){
                let normalized = values[row][col] / maxDensity;
                let band = bands.find((item) => normalized <= item.limit);

                this.ctx.fillStyle = band.color;
                this.ctx.fillRect(col * cellSize,row * cellSize,cellSize,cellSize);
            }
        }
    }

    drawMeanShiftContourLines(values,maxDensity,cellSize){
        let levels = [0.18,0.32,0.46,0.60,0.74,0.88];

        this.ctx.save();
        this.ctx.lineWidth = 1.1;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";

        for(let [levelIndex,levelRatio] of levels.entries()){
            let threshold = maxDensity * levelRatio;
            this.ctx.beginPath();

            for(let row = 0;row < values.length - 1;row++){
                for(let col = 0;col < values[row].length - 1;col++){
                    this.drawMeanShiftContourCell(values,row,col,threshold,cellSize);
                }
            }

            let alpha = 0.18 + levelIndex * 0.055;
            this.ctx.strokeStyle = `rgba(15, 23, 42, ${alpha})`;
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    drawMeanShiftContourCell(values,row,col,threshold,cellSize){
        let x = col * cellSize;
        let y = row * cellSize;
        let topLeft = values[row][col];
        let topRight = values[row][col + 1];
        let bottomRight = values[row + 1][col + 1];
        let bottomLeft = values[row + 1][col];
        let points = [];

        let addIntersection = (first,second,firstPoint,secondPoint) => {
            if((first < threshold && second < threshold) || (first >= threshold && second >= threshold)){
                return;
            }

            let ratio = (threshold - first) / (second - first);
            points.push({
                x:firstPoint.x + (secondPoint.x - firstPoint.x) * ratio,
                y:firstPoint.y + (secondPoint.y - firstPoint.y) * ratio
            });
        };

        addIntersection(topLeft,topRight,{x:x,y:y},{x:x + cellSize,y:y});
        addIntersection(topRight,bottomRight,{x:x + cellSize,y:y},{x:x + cellSize,y:y + cellSize});
        addIntersection(bottomRight,bottomLeft,{x:x + cellSize,y:y + cellSize},{x:x,y:y + cellSize});
        addIntersection(bottomLeft,topLeft,{x:x,y:y + cellSize},{x:x,y:y});

        if(points.length < 2){
            return;
        }

        for(let i = 0;i < points.length - 1;i += 2){
            this.ctx.moveTo(points[i].x,points[i].y);
            this.ctx.lineTo(points[i + 1].x,points[i + 1].y);
        }
    }

    drawTrails(trails,assignment,clusters){
        for(let i = 0;i < trails.length;i++){
            let path = trails[i];

            if(!path || path.length < 2){
                continue;
            }

            let clusterIndex = assignment ? assignment[i] : 0;
            let cluster = clusters && clusterIndex >= 0 ? clusters[clusterIndex] : [];
            let color = clusterIndex >= 0 && cluster.length > 2 ? cluster_color[clusterIndex % cluster_color.length] : "#9ca3af";

            this.ctx.beginPath();
            this.ctx.moveTo(path[0].x,path[0].y);

            for(let j = 1;j < path.length;j++){
                this.ctx.lineTo(path[j].x,path[j].y);
            }

            this.ctx.strokeStyle = this.colorAlpha(color,0.24);
            this.ctx.lineWidth = 1.4;
            this.ctx.stroke();

            let last = path[path.length - 1];
            this.ctx.beginPath();
            this.ctx.arc(last.x,last.y,2.5,0,2 * Math.PI,false);
            this.ctx.fillStyle = this.colorAlpha(color,0.55);
            this.ctx.fill();
        }
    }

    drawNearestPointBoundaries(clusters){
        let cellSize = 10;

        for(let y = 0;y < this.height;y += cellSize){
            for(let x = 0;x < this.width;x += cellSize){
                let point = {x:x + cellSize / 2,y:y + cellSize / 2};
                let candidate = -1;
                let minDistance = Infinity;

                for(let [i,cluster] of clusters.entries()){
                    for(let clusterPoint of cluster){
                        let distance = euclidianDistance(point,clusterPoint);

                        if(distance < minDistance){
                            minDistance = distance;
                            candidate = i;
                        }
                    }
                }

                if(candidate >= 0){
                    this.ctx.fillStyle = this.colorAlpha(cluster_color[candidate % cluster_color.length],0.10);
                    this.ctx.fillRect(x,y,cellSize,cellSize);
                }
            }
        }
    }

    drawInfo(text){
        this.ctx.save();
        this.ctx.font = "700 13px Arial";
        this.ctx.fillStyle = "rgba(17, 24, 39, 0.76)";
        this.ctx.fillText(text,16,24);
        this.ctx.restore();
    }

    drawGMM(data,result,showBoundaries){
        this.reset();

        if(!result){
            this.drawPoints(data,"#000000");
            return;
        }

        if(showBoundaries){
            this.drawGMMBoundaries(result);
        }

        for(let [i,cluster] of result.clusters.entries()){
            let color = cluster_color[i % cluster_color.length];

            for(let point of cluster){
                let idx = data.indexOf(point);
                let confidence = idx >= 0 ? result.confidence[idx] : 1;
                let alpha = 0.25 + confidence * 0.75;

                this.drawPointAlpha(point,color,alpha);
            }
        }

        for(let [i,component] of result.components.entries()){
            let color = cluster_color[i % cluster_color.length];
            this.drawGaussianEllipse(component,color);
            this.drawCentroids([component.mean],color);
            this.drawLabel(
                {x:component.mean.x + 8,y:component.mean.y - 8},
                `G${i + 1}`,
                "#111827",
                "700 12px Arial"
            );
        }

        this.ctx.save();
        this.ctx.font = "700 13px Arial";
        this.ctx.fillStyle = "rgba(17, 24, 39, 0.76)";
        this.ctx.fillText(`GMM - iterations: ${result.iterations} - alpha = confidence`,16,24);
        this.ctx.restore();
    }

    drawGMMBoundaries(result){
        let cellSize = 10;

        for(let y = 0;y < this.height;y += cellSize){
            for(let x = 0;x < this.width;x += cellSize){
                let point = {x:x + cellSize / 2,y:y + cellSize / 2};
                let candidate = 0;
                let maxProbability = -Infinity;

                for(let [i,component] of result.components.entries()){
                    let probability = component.weight * GMM.gaussian(point,component.mean,component.cov);

                    if(probability > maxProbability){
                        maxProbability = probability;
                        candidate = i;
                    }
                }

                this.ctx.fillStyle = this.colorAlpha(cluster_color[candidate % cluster_color.length],0.12);
                this.ctx.fillRect(x,y,cellSize,cellSize);
            }
        }
    }

    drawGaussianEllipse(component,color){
        let cov = component.cov;
        let a = cov.a;
        let b = cov.b;
        let c = cov.c;
        let trace = a + c;
        let detPart = Math.sqrt(Math.max(0,Math.pow(a - c,2) + 4 * b * b));
        let lambda1 = Math.max(4,(trace + detPart) / 2);
        let lambda2 = Math.max(4,(trace - detPart) / 2);
        let angle = 0.5 * Math.atan2(2 * b,a - c);

        this.ctx.save();
        this.ctx.translate(component.mean.x,component.mean.y);
        this.ctx.rotate(angle);

        for(let scale of [1,2]){
            this.ctx.beginPath();
            this.ctx.ellipse(
                0,
                0,
                Math.sqrt(lambda1) * scale,
                Math.sqrt(lambda2) * scale,
                0,
                0,
                2 * Math.PI
            );
            this.ctx.lineWidth = scale === 1 ? 2 : 1;
            this.ctx.strokeStyle = scale === 1 ? this.colorAlpha(color,0.75) : this.colorAlpha(color,0.35);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    drawDBSCAN(data,result,showEpsilon,showBoundaries){
        this.reset();

        if(!result){
            this.drawPoints(data,"#000000");
            return;
        }

        if(showBoundaries){
            this.drawDBSCANBoundaries(result);
        }

        if(showEpsilon){
            this.drawDBSCANRanges(data,result);
        }

        for(let [i,cluster] of result.clusters.entries()){
            this.drawPoints(cluster,cluster_color[i % cluster_color.length]);
        }

        this.drawCentroids(result.noise,"#000000");
        this.drawPoints(result.border,"#A020F0");
    }

    drawDBSCANRanges(data,result){
        let maxCount = Math.max(1,...result.neighborCounts);

        for(let [i,point] of data.entries()){
            let density = (result.neighborCounts[i] || 1) / maxCount;
            let alpha = 0.16 + density * 0.28;
            let lineWidth = 1 + density * 2;

            this.drawRadius(point.x,point.y,result.eps,`rgba(73, 82, 96, ${alpha})`,lineWidth);
        }
    }

    drawDBSCANBoundaries(result){
        let cellSize = 8;

        for(let y = 0;y < this.height;y += cellSize){
            for(let x = 0;x < this.width;x += cellSize){
                let point = {x:x + cellSize / 2,y:y + cellSize / 2};
                let candidate = -1;
                let minDistance = Infinity;

                for(let [i,cluster] of result.clusters.entries()){
                    let cores = cluster.filter((item) => item.label === "core");
                    let points = cores.length > 0 ? cores : cluster;

                    for(let clusterPoint of points){
                        let distance = euclidianDistance(point,clusterPoint);

                        if(distance <= result.eps && distance < minDistance){
                            minDistance = distance;
                            candidate = i;
                        }
                    }
                }

                if(candidate >= 0){
                    this.ctx.fillStyle = this.colorAlpha(cluster_color[candidate % cluster_color.length],0.13);
                    this.ctx.fillRect(x,y,cellSize,cellSize);
                }
            }
        }
    }

    drawHDBSCAN(data,result,showBoundaries){
        this.reset();

        if(!result){
            this.drawPoints(data,"#000000");
            return;
        }

        if(result.phase === "core"){
            this.drawPoints(data,"#000000");
            this.drawCoreDistances(data,result.coreDistances);
            this.drawHDBSCANInfo(result);
            return;
        }

        if(result.phase === "mutual"){
            this.drawPoints(data,"#000000");
            this.drawMST(result.reachabilityEdges || [],"rgba(71, 85, 105, 0.12)");
            this.drawHDBSCANInfo(result);
            return;
        }

        if(result.phase === "mst"){
            this.drawPoints(data,"#000000");
            this.drawMST(result.mst,"rgba(37, 99, 235, 0.34)");
            this.drawHDBSCANInfo(result);
            return;
        }

        if(showBoundaries){
            this.drawHDBSCANBoundaries(result);
        }

        this.drawMST(result.mst,"rgba(71, 85, 105, 0.24)");

        for(let [i,cluster] of result.clusters.entries()){
            this.drawPoints(cluster,cluster_color[i % cluster_color.length]);
            this.drawClusterHull(cluster,cluster_color[i % cluster_color.length]);
        }

        this.drawCentroids(result.noise,"#000000");

        this.drawHDBSCANInfo(result);
    }

    drawCoreDistances(data,coreDistances){
        for(let [i,point] of data.entries()){
            this.drawRadius(point.x,point.y,coreDistances[i],"rgba(73, 82, 96, 0.22)",1);
        }
    }

    drawHDBSCANInfo(result){
        let text = result.phaseLabel || `HDBSCAN - threshold: ${result.threshold.toFixed(2)} - clusters: ${result.clusters.length}`;

        if(result.stability !== undefined){
            text += ` - stability: ${result.stability.toFixed(2)}`;
        }

        this.ctx.save();
        this.ctx.font = "700 13px Arial";
        this.ctx.fillStyle = "rgba(17, 24, 39, 0.76)";
        this.ctx.fillText(text,16,24);
        this.ctx.restore();
    }

    drawMST(edges,color){
        let visibleEdges = edges.length > 1200
            ? edges.slice().sort((a,b) => a.weight - b.weight).slice(0,1200)
            : edges;

        for(let edge of visibleEdges){
            this.ctx.beginPath();
            this.ctx.moveTo(edge.a.x,edge.a.y);
            this.ctx.lineTo(edge.b.x,edge.b.y);
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = color;
            this.ctx.stroke();
        }
    }

    drawClusterHull(cluster,color){
        if(cluster.length === 0){
            return;
        }

        let centroid = this.getCentroid(cluster);
        let radius = Math.max(18,getMaxDist(cluster,centroid));

        this.ctx.beginPath();
        this.ctx.arc(centroid.x,centroid.y,radius,0,2 * Math.PI,false);
        this.ctx.fillStyle = this.colorAlpha(color,0.07);
        this.ctx.fill();
        this.ctx.lineWidth = 1.6;
        this.ctx.strokeStyle = this.colorAlpha(color,0.45);
        this.ctx.stroke();
    }

    drawHDBSCANBoundaries(result){
        let cellSize = 10;

        for(let y = 0;y < this.height;y += cellSize){
            for(let x = 0;x < this.width;x += cellSize){
                let point = {x:x + cellSize / 2,y:y + cellSize / 2};
                let candidate = -1;
                let minDistance = Infinity;

                for(let [i,cluster] of result.clusters.entries()){
                    for(let clusterPoint of cluster){
                        let distance = euclidianDistance(point,clusterPoint);

                        if(distance < minDistance){
                            minDistance = distance;
                            candidate = i;
                        }
                    }
                }

                if(candidate >= 0 && minDistance <= result.threshold){
                    this.ctx.fillStyle = this.colorAlpha(cluster_color[candidate % cluster_color.length],0.11);
                    this.ctx.fillRect(x,y,cellSize,cellSize);
                }
            }
        }
    }

    getCentroid(points){
        let x = 0;
        let y = 0;

        for(let point of points){
            x += point.x;
            y += point.y;
        }

        return {
            x:x / points.length,
            y:y / points.length
        };
    }

    drawHCluster(result){
        this.reset();

        if(!result){
            return;
        }

        let activeClusters = result.currentClusters || result.allClusters;

        this.drawHClusterLinks(result);

        for(let [i,cluster] of activeClusters.entries()){
            this.drawHClusterBubble(cluster,cluster_color[i % cluster_color.length]);
        }

        this.drawHClusterLabels(result,activeClusters);

        if(result.currentClusters && result.currentClusters.length === 1 && result.initClusters > 1){
            this.drawHClusterTree(result);
        }

        this.drawHClusterInfo(result);
    }

    drawHClusterLinks(result){
        let clusterMap = new Map(result.allClusters.map((cluster) => [cluster.id,cluster]));

        for(let cluster of result.allClusters){
            if(!cluster.tree || cluster.tree.length !== 2){
                continue;
            }

            for(let childId of cluster.tree){
                let child = clusterMap.get(childId);

                if(!child){
                    continue;
                }

                this.ctx.beginPath();
                this.ctx.moveTo(child.centroid.x,child.centroid.y);
                this.ctx.lineTo(cluster.centroid.x,cluster.centroid.y);
                this.ctx.lineWidth = Math.min(3,0.8 + cluster.points.length / 40);
                this.ctx.strokeStyle = "rgba(74, 85, 104, 0.34)";
                this.ctx.stroke();
            }
        }
    }

    drawHClusterLabels(result,activeClusters){
        let activeIds = new Set(activeClusters.map((cluster) => cluster.id));

        for(let cluster of result.allClusters){
            let isActive = activeIds.has(cluster.id);
            let label = cluster.points.length === 1 ? `P${cluster.points[0].i + 1}` : `C${cluster.id}`;

            this.drawSoftLabel(cluster.centroid,label,isActive);
        }
    }

    drawHClusterBubble(cluster,color){
        let radius = cluster.points.length === 1 ? 18 : Math.max(22,getMaxDist(cluster.points,cluster.centroid));

        this.ctx.beginPath();
        this.ctx.arc(cluster.centroid.x,cluster.centroid.y,radius,0,2 * Math.PI,false);
        this.ctx.fillStyle = this.colorAlpha(color,0.09);
        this.ctx.fill();
        this.ctx.lineWidth = Math.min(4,1.2 + cluster.points.length / 18);
        this.ctx.strokeStyle = this.colorAlpha(color,0.62);
        this.ctx.stroke();

        this.drawPoints(cluster.points,color);

        this.ctx.beginPath();
        this.ctx.arc(cluster.centroid.x,cluster.centroid.y,5,0,2 * Math.PI,false);
        this.ctx.fillStyle = "#111827";
        this.ctx.fill();

        this.drawLabel(
            {x:cluster.centroid.x + 8,y:cluster.centroid.y - 8},
            `C${cluster.id} (${cluster.points.length})`,
            "#111827",
            "700 12px Arial"
        );
    }

    drawHClusterInfo(result){
        let text = `${result.linkage} / ${result.metric} - merge: ${result.iterations}`;

        this.ctx.save();
        this.ctx.font = "700 13px Arial";
        this.ctx.fillStyle = "rgba(17, 24, 39, 0.76)";
        this.ctx.fillText(text,16,24);
        this.ctx.restore();
    }

    drawHClusterTree(result){
        let root = result.currentClusters[0];
        let clusterMap = new Map(result.allClusters.map((cluster) => [cluster.id,cluster]));
        let leaves = [];

        let collectLeaves = (cluster) => {
            if(!cluster.tree || cluster.tree.length === 0){
                leaves.push(cluster);
                return;
            }

            for(let childId of cluster.tree){
                let child = clusterMap.get(childId);

                if(child){
                    collectLeaves(child);
                }
            }
        };

        collectLeaves(root);

        let panelWidth = Math.min(420,Math.max(280,this.width * 0.36));
        let panel = {
            x:this.width - panelWidth - 18,
            y:44,
            width:panelWidth,
            height:Math.max(260,this.height - 76)
        };

        let left = panel.x + 28;
        let right = panel.x + panel.width - 54;
        let top = panel.y + 46;
        let bottom = panel.y + panel.height - 22;
        let leafGap = leaves.length > 1 ? (bottom - top) / (leaves.length - 1) : 0;
        let rootLevel = Math.max(1,root.level || 1);
        let layout = new Map();

        for(let [i,leaf] of leaves.entries()){
            layout.set(leaf.id,{
                x:right,
                y:top + i * leafGap
            });
        }

        let place = (cluster) => {
            if(layout.has(cluster.id)){
                return layout.get(cluster.id);
            }

            let children = cluster.tree
                .map((childId) => clusterMap.get(childId))
                .filter(Boolean);

            let childPositions = children.map((child) => place(child));
            let y = childPositions.reduce((sum,point) => sum + point.y,0) / childPositions.length;
            let levelRatio = (cluster.level || 0) / rootLevel;
            let x = right - levelRatio * (right - left);
            let position = {x:x,y:y};

            layout.set(cluster.id,position);
            return position;
        };

        place(root);

        this.ctx.save();
        this.ctx.fillStyle = "rgba(255,255,255,0.92)";
        this.ctx.strokeStyle = "rgba(148,163,184,0.7)";
        this.ctx.lineWidth = 1;
        this.roundRect(panel.x,panel.y,panel.width,panel.height,14);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = "#172033";
        this.ctx.font = "800 13px Arial";
        this.ctx.fillText("HCluster hierarchy",panel.x + 16,panel.y + 24);

        for(let cluster of result.allClusters){
            if(!cluster.tree || cluster.tree.length !== 2 || !layout.has(cluster.id)){
                continue;
            }

            let parent = layout.get(cluster.id);

            for(let childId of cluster.tree){
                let child = layout.get(childId);

                if(!child){
                    continue;
                }

                let elbowX = (parent.x + child.x) / 2;
                this.ctx.beginPath();
                this.ctx.moveTo(parent.x,parent.y);
                this.ctx.lineTo(elbowX,parent.y);
                this.ctx.lineTo(elbowX,child.y);
                this.ctx.lineTo(child.x,child.y);
                this.ctx.lineWidth = 1.2;
                this.ctx.strokeStyle = "rgba(37,99,235,0.42)";
                this.ctx.stroke();
            }
        }

        let leafFont = leaves.length > 35 ? "8px Arial" : "10px Arial";

        for(let cluster of result.allClusters){
            let position = layout.get(cluster.id);

            if(!position){
                continue;
            }

            let isLeaf = !cluster.tree || cluster.tree.length === 0;
            let label = isLeaf ? `P${cluster.points[0].i + 1}` : `C${cluster.id}`;

            this.ctx.beginPath();
            this.ctx.arc(position.x,position.y,isLeaf ? 2.4 : 3.6,0,2 * Math.PI,false);
            this.ctx.fillStyle = isLeaf ? "#334155" : "#1769e0";
            this.ctx.fill();

            this.ctx.fillStyle = isLeaf ? "#475569" : "#0f172a";
            this.ctx.font = isLeaf ? leafFont : "700 9px Arial";
            this.ctx.fillText(label,position.x + 6,position.y + 3);
        }

        this.ctx.restore();
    }

    roundRect(x,y,width,height,radius){
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius,y);
        this.ctx.lineTo(x + width - radius,y);
        this.ctx.quadraticCurveTo(x + width,y,x + width,y + radius);
        this.ctx.lineTo(x + width,y + height - radius);
        this.ctx.quadraticCurveTo(x + width,y + height,x + width - radius,y + height);
        this.ctx.lineTo(x + radius,y + height);
        this.ctx.quadraticCurveTo(x,y + height,x,y + height - radius);
        this.ctx.lineTo(x,y + radius);
        this.ctx.quadraticCurveTo(x,y,x + radius,y);
        this.ctx.closePath();
    }
}

/*
    K-Means.
    Assigns each point to the nearest centroid, then moves centroids
    to the average of their assigned points. Repeats until centroids stabilize.
*/
class kMeans{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.init_centroid = [];
        this.clusters = [];
        this.steps = [];
    }

    reset(){
        this.init_centroid = [];
        this.clusters = [];
        this.steps = [];
    }

    generateInitCentroids(k){
        this.init_centroid = [];

        for(let i = 0;i < k;i++){
            this.init_centroid.push({
                x:Math.floor(Math.random() * this.canvasHandler.width),
                y:Math.floor(Math.random() * this.canvasHandler.height)
            });
        }

        return this.init_centroid;
    }

    kppCentroids(data,k){
        this.init_centroid = [];

        if(data.length === 0 || k <= 0){
            return this.init_centroid;
        }

        let firstIndex = parseInt(Math.random() * data.length);
        this.init_centroid.push({x:data[firstIndex].x,y:data[firstIndex].y});

        while(this.init_centroid.length < k){
            let candidate = null;
            let maxDistance = -Infinity;

            for(let point of data){
                let minDistance = Infinity;

                for(let centroid of this.init_centroid){
                    let distance = euclidianDistance(point,centroid);

                    if(distance < minDistance){
                        minDistance = distance;
                    }
                }

                if(minDistance > maxDistance){
                    maxDistance = minDistance;
                    candidate = point;
                }
            }

            if(!candidate){
                break;
            }

            this.init_centroid.push({x:candidate.x,y:candidate.y});
        }

        return this.init_centroid;
    }

    run(data,maxIterations = 100){
        /* Every intermediate result is saved for Step mode. */
        let centroids = this.init_centroid.map((point) => ({x:point.x,y:point.y}));
        let clusters = [];
        let steps = [];
        let hasConvergence = false;
        let iteration = 0;

        while(iteration < maxIterations && !hasConvergence){
            clusters = this.assignCluster(data,centroids);
            let newCentroids = this.updateCentroids(clusters);

            steps.push({
                clusters: clusters.map((cluster) => ({
                    centroid:{...cluster.centroid},
                    points:cluster.points.map((point) => ({...point}))
                })),
                centroids: newCentroids.map((point) => ({...point})),
                iterations: iteration + 1
            });

            hasConvergence = JSON.stringify(centroids) === JSON.stringify(newCentroids);
            centroids = newCentroids;
            iteration++;
        }

        this.clusters = clusters;
        this.steps = steps;

        return {
            clusters:clusters,
            centroids:centroids,
            steps:steps,
            iterations:iteration
        };
    }

    assignCluster(data,centroids){
        let clusters = centroids.map((centroid) => ({
            centroid:{x:centroid.x,y:centroid.y},
            points:[]
        }));

        for(let point of data){
            let minDistance = Infinity;
            let candidate = 0;

            for(let [i,centroid] of centroids.entries()){
                let distance = euclidianDistance(point,centroid);

                if(distance < minDistance){
                    minDistance = distance;
                    candidate = i;
                }
            }

            clusters[candidate].points.push(point);
        }

        return clusters;
    }

    updateCentroids(clusters){
        let newCentroids = [];

        for(let cluster of clusters){
            if(cluster.points.length === 0){
                newCentroids.push({x:cluster.centroid.x,y:cluster.centroid.y});
                continue;
            }

            let xAvg = 0;
            let yAvg = 0;

            for(let point of cluster.points){
                xAvg += point.x;
                yAvg += point.y;
            }

            newCentroids.push({
                x:xAvg / cluster.points.length,
                y:yAvg / cluster.points.length
            });
        }

        return newCentroids;
    }
}

/*
    Spectral Clustering
    Builds an RBF affinity matrix, normalizes it with the degree matrix,
    extracts a spectral embedding and then runs K-Means in the transformed space.
*/
class SpectralClustering{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,k,sigma){
        /* Pipeline: affinity -> normalized Laplacian -> embedding -> K-Means. */
        let affinity = this.calculateAffinity(data,sigma);
        let laplacian = this.calculateNormalizedLaplacian(affinity);
        let normalizedAffinity = this.calculateNormalizedAffinity(affinity);
        let eigenvectors = this.powerEigenvectors(normalizedAffinity,k);
        let embedding = this.buildEmbedding(eigenvectors);
        let clustered = this.kmeansEmbedding(embedding,k);
        let clusters = this.buildClusters(data,clustered.assignment,k);

        this.steps = [
            {
                clusters:[data],
                phaseLabel:"1. RBF similarity calculated"
            },
            {
                clusters:[data],
                phaseLabel:"2. Normalized Laplacian L calculated"
            },
            {
                clusters:[data],
                phaseLabel:"3. Laplacian eigenvectors extracted"
            },
            {
                clusters:clusters,
                phaseLabel:"4. K-Means in spectral space"
            }
        ];

        return {
            clusters:clusters,
            embedding:embedding,
            affinity:affinity,
            laplacian:laplacian,
            steps:this.steps,
            phaseLabel:"final clusters"
        };
    }

    calculateAffinity(data,sigma){
        let matrix = [];
        let div = 2 * sigma * sigma;

        for(let i = 0;i < data.length;i++){
            matrix[i] = [];

            for(let j = 0;j < data.length;j++){
                if(i === j){
                    matrix[i][j] = 0;
                }else{
                    let distance = euclidianDistance(data[i],data[j]);
                    matrix[i][j] = Math.exp(-(distance * distance) / div);
                }
            }
        }

        return matrix;
    }

    calculateDegree(affinity){
        let degree = [];

        for(let row of affinity){
            degree.push(row.reduce((sum,value) => sum + value,0));
        }

        return degree;
    }

    calculateNormalizedAffinity(affinity){
        let degree = this.calculateDegree(affinity);
        let matrix = [];

        for(let i = 0;i < affinity.length;i++){
            matrix[i] = [];

            for(let j = 0;j < affinity.length;j++){
                let denom = Math.sqrt(Math.max(degree[i],0.0001) * Math.max(degree[j],0.0001));
                matrix[i][j] = affinity[i][j] / denom;
            }
        }

        return matrix;
    }

    calculateNormalizedLaplacian(affinity){
        let normalizedAffinity = this.calculateNormalizedAffinity(affinity);
        let laplacian = [];

        for(let i = 0;i < normalizedAffinity.length;i++){
            laplacian[i] = [];

            for(let j = 0;j < normalizedAffinity.length;j++){
                laplacian[i][j] = (i === j ? 1 : 0) - normalizedAffinity[i][j];
            }
        }

        return laplacian;
    }

    powerEigenvectors(matrix,k){
        let work = matrix.map((row) => row.slice());
        let vectors = [];
        let n = matrix.length;

        for(let comp = 0;comp < k;comp++){
            let vector = [];

            for(let i = 0;i < n;i++){
                vector.push(Math.random());
            }

            vector = this.normalizeVector(vector);

            for(let iter = 0;iter < 60;iter++){
                vector = this.normalizeVector(this.multiplyMatrixVector(work,vector));
            }

            let av = this.multiplyMatrixVector(work,vector);
            let lambda = this.dot(vector,av);
            vectors.push(vector.slice());

            for(let i = 0;i < n;i++){
                for(let j = 0;j < n;j++){
                    work[i][j] -= lambda * vector[i] * vector[j];
                }
            }
        }

        return vectors;
    }

    multiplyMatrixVector(matrix,vector){
        let result = [];

        for(let row of matrix){
            let value = 0;

            for(let i = 0;i < vector.length;i++){
                value += row[i] * vector[i];
            }

            result.push(value);
        }

        return result;
    }

    normalizeVector(vector){
        let norm = Math.sqrt(vector.reduce((sum,value) => sum + value * value,0));

        if(norm === 0){
            return vector.map(() => 0);
        }

        return vector.map((value) => value / norm);
    }

    dot(vector1,vector2){
        let value = 0;

        for(let i = 0;i < vector1.length;i++){
            value += vector1[i] * vector2[i];
        }

        return value;
    }

    buildEmbedding(eigenvectors){
        let embedding = [];
        let n = eigenvectors[0].length;

        for(let i = 0;i < n;i++){
            let row = [];

            for(let vector of eigenvectors){
                row.push(vector[i]);
            }

            embedding.push(this.normalizeVector(row));
        }

        return embedding;
    }

    kmeansEmbedding(embedding,k){
        let centroids = embedding.slice(0,k).map((row) => row.slice());
        let assignment = new Array(embedding.length).fill(0);

        for(let iter = 0;iter < 40;iter++){
            let changed = false;

            for(let i = 0;i < embedding.length;i++){
                let candidate = 0;
                let minDistance = Infinity;

                for(let c = 0;c < centroids.length;c++){
                    let distance = this.vectorDistance(embedding[i],centroids[c]);

                    if(distance < minDistance){
                        minDistance = distance;
                        candidate = c;
                    }
                }

                if(assignment[i] !== candidate){
                    changed = true;
                    assignment[i] = candidate;
                }
            }

            let sums = [];
            let counts = [];

            for(let c = 0;c < k;c++){
                sums.push(new Array(embedding[0].length).fill(0));
                counts.push(0);
            }

            for(let i = 0;i < embedding.length;i++){
                counts[assignment[i]]++;

                for(let d = 0;d < embedding[i].length;d++){
                    sums[assignment[i]][d] += embedding[i][d];
                }
            }

            for(let c = 0;c < k;c++){
                if(counts[c] === 0){
                    continue;
                }

                centroids[c] = sums[c].map((value) => value / counts[c]);
            }

            if(!changed){
                break;
            }
        }

        return {
            assignment:assignment,
            centroids:centroids
        };
    }

    vectorDistance(vector1,vector2){
        let value = 0;

        for(let i = 0;i < vector1.length;i++){
            value += Math.pow(vector2[i] - vector1[i],2);
        }

        return Math.sqrt(value);
    }

    buildClusters(data,assignment,k){
        let clusters = [];

        for(let i = 0;i < k;i++){
            clusters.push([]);
        }

        for(let i = 0;i < data.length;i++){
            clusters[assignment[i]].push(data[i]);
        }

        return clusters;
    }
}

/*
    Fuzzy C-Means.
    Each point belongs to all clusters with different weights.
    Canvas transparency shows how strong the main membership is.
*/
class FuzzyCMeans{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,k,m,maxIterations){
        /* m controls how soft the memberships are. */
        let memberships = this.initMembership(data.length,k);
        let centroids = [];
        let steps = [];
        let iterations = 0;

        for(let iter = 0;iter < maxIterations;iter++){
            centroids = this.updateCentroids(data,memberships,k,m);
            memberships = this.updateMemberships(data,centroids,m);
            iterations = iter + 1;

            steps.push(this.buildResult(data,memberships,centroids,iterations));
        }

        this.steps = steps;

        let result = this.buildResult(data,memberships,centroids,iterations);
        result.steps = steps;
        return result;
    }

    initMembership(n,k){
        let memberships = [];

        for(let i = 0;i < n;i++){
            let row = [];
            let total = 0;

            for(let c = 0;c < k;c++){
                let value = Math.random();
                row.push(value);
                total += value;
            }

            memberships.push(row.map((value) => value / total));
        }

        return memberships;
    }

    updateCentroids(data,memberships,k,m){
        let centroids = [];

        for(let c = 0;c < k;c++){
            let x = 0;
            let y = 0;
            let total = 0;

            for(let i = 0;i < data.length;i++){
                let weight = Math.pow(memberships[i][c],m);
                x += weight * data[i].x;
                y += weight * data[i].y;
                total += weight;
            }

            if(total === 0){
                centroids.push({x:data[0].x,y:data[0].y});
            }else{
                centroids.push({x:x / total,y:y / total});
            }
        }

        return centroids;
    }

    updateMemberships(data,centroids,m){
        let memberships = [];
        let power = 2 / (m - 1);

        for(let point of data){
            let row = [];

            for(let c = 0;c < centroids.length;c++){
                let distC = Math.max(euclidianDistance(point,centroids[c]),0.0001);
                let sum = 0;

                for(let j = 0;j < centroids.length;j++){
                    let distJ = Math.max(euclidianDistance(point,centroids[j]),0.0001);
                    sum += Math.pow(distC / distJ,power);
                }

                row.push(1 / sum);
            }

            memberships.push(row);
        }

        return memberships;
    }

    buildResult(data,memberships,centroids,iterations){
        let clusters = centroids.map(() => []);
        let confidence = [];

        for(let i = 0;i < data.length;i++){
            let candidate = 0;
            let maxMembership = -Infinity;

            for(let c = 0;c < memberships[i].length;c++){
                if(memberships[i][c] > maxMembership){
                    maxMembership = memberships[i][c];
                    candidate = c;
                }
            }

            clusters[candidate].push(data[i]);
            confidence.push(maxMembership);
        }

        return {
            clusters:clusters,
            memberships:memberships.map((row) => row.slice()),
            confidence:confidence,
            centroids:centroids.map((point) => ({...point})),
            iterations:iterations
        };
    }
}

/*
    Mean Shift.
    It does not split the whole space: it pushes each point toward a denser area.
    Points that converge to the same mode become a cluster.
*/
class MeanShift{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,bandwidth,maxIterations){
        /* shifted stores moving positions, data stays as the original dataset to draw. */
        let shifted = data.map((point) => ({x:point.x,y:point.y}));
        let trails = data.map((point) => [{x:point.x,y:point.y}]);
        let steps = [];
        let iterations = 0;

        for(let iter = 0;iter < maxIterations;iter++){
            let maxShift = 0;
            let next = [];

            for(let [i,point] of shifted.entries()){
                let shiftedPoint = this.shiftPoint(point,data,bandwidth);
                let distance = euclidianDistance(point,shiftedPoint);

                if(distance > maxShift){
                    maxShift = distance;
                }

                next.push(shiftedPoint);
                trails[i].push({x:shiftedPoint.x,y:shiftedPoint.y});
            }

            shifted = next;
            iterations = iter + 1;

            steps.push(this.buildResult(data,shifted,bandwidth,iterations,trails));

            if(maxShift < 0.5){
                break;
            }
        }

        this.steps = steps;

        let result = this.buildResult(data,shifted,bandwidth,iterations,trails);
        result.steps = steps;
        return result;
    }

    shiftPoint(point,data,bandwidth){
        let x = 0;
        let y = 0;
        let total = 0;

        for(let other of data){
            let distance = euclidianDistance(point,other);

            if(distance <= bandwidth){
                let weight = Math.exp(-(distance * distance) / (2 * bandwidth * bandwidth));
                x += other.x * weight;
                y += other.y * weight;
                total += weight;
            }
        }

        if(total === 0){
            return {x:point.x,y:point.y};
        }

        return {
            x:x / total,
            y:y / total
        };
    }

    buildResult(data,shifted,bandwidth,iterations,trails){
        let modes = [];
        let assignment = [];

        for(let shiftedPoint of shifted){
            let candidate = -1;

            for(let [i,mode] of modes.entries()){
                if(euclidianDistance(shiftedPoint,mode) <= bandwidth / 2){
                    candidate = i;
                    break;
                }
            }

            if(candidate === -1){
                modes.push({x:shiftedPoint.x,y:shiftedPoint.y});
                candidate = modes.length - 1;
            }

            assignment.push(candidate);
        }

        let clusters = modes.map(() => []);

        for(let i = 0;i < data.length;i++){
            clusters[assignment[i]].push(data[i]);
        }

        let weakCount = clusters.reduce((total,cluster) => {
            return cluster.length <= 2 ? total + cluster.length : total;
        },0);

        return {
            clusters:clusters,
            modes:modes,
            assignment:assignment,
            shifted:shifted.map((point) => ({...point})),
            trails:trails.map((path) => path.map((point) => ({...point}))),
            bandwidth:bandwidth,
            weakCount:weakCount,
            iterations:iterations,
            phaseLabel:`shift toward dense areas ${iterations}`
        };
    }
}

/*
    Gaussian Mixture Model.
    Uses EM: E-step for point responsibilities, M-step to update
    weight, mean and covariance of each Gaussian component.
*/
class GMM{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.components = [];
        this.steps = [];
        this.regularizer = 0.0001;
    }

    run(data,k,maxIterations = 50){
        /* responsibilities[i][j] says how much point i belongs to Gaussian j. */
        this.components = this.initComponents(data,k);
        this.steps = [];

        let oldLogLikelihood = -Infinity;
        let responsibilities = [];
        let iterations = 0;

        for(let iter = 0;iter < maxIterations;iter++){
            responsibilities = this.eStep(data,this.components);
            this.components = this.mStep(data,responsibilities,this.components.length);
            responsibilities = this.eStep(data,this.components);

            let logLikelihood = this.logLikelihood(data,this.components);
            let result = this.buildResult(data,responsibilities,iter + 1,logLikelihood);

            this.steps.push(result);
            iterations = iter + 1;

            if(Math.abs(logLikelihood - oldLogLikelihood) < 0.001){
                break;
            }

            oldLogLikelihood = logLikelihood;
        }

        responsibilities = this.eStep(data,this.components);

        let finalResult = this.buildResult(data,responsibilities,iterations,this.logLikelihood(data,this.components));
        finalResult.steps = this.steps;

        return finalResult;
    }

    initComponents(data,k){
        let means = [];
        let components = [];
        let firstIndex = parseInt(Math.random() * data.length);

        means.push({x:data[firstIndex].x,y:data[firstIndex].y});

        while(means.length < k){
            let candidate = null;
            let maxDistance = -Infinity;

            for(let point of data){
                let minDistance = Infinity;

                for(let mean of means){
                    let distance = euclidianDistance(point,mean);

                    if(distance < minDistance){
                        minDistance = distance;
                    }
                }

                if(minDistance > maxDistance){
                    maxDistance = minDistance;
                    candidate = point;
                }
            }

            if(!candidate){
                break;
            }

            means.push({x:candidate.x,y:candidate.y});
        }

        let globalCov = this.globalCovariance(data);

        for(let mean of means){
            components.push({
                weight:1 / means.length,
                mean:{x:mean.x,y:mean.y},
                cov:{a:globalCov.a,b:globalCov.b,c:globalCov.c}
            });
        }

        return components;
    }

    globalCovariance(data){
        let mean = this.calculateMean(data);
        let a = 0;
        let b = 0;
        let c = 0;

        for(let point of data){
            let dx = point.x - mean.x;
            let dy = point.y - mean.y;

            a += dx * dx;
            b += dx * dy;
            c += dy * dy;
        }

        a = a / data.length + this.regularizer;
        b = b / data.length;
        c = c / data.length + this.regularizer;

        return {
            a:Math.max(a,25),
            b:b,
            c:Math.max(c,25)
        };
    }

    calculateMean(points){
        let x = 0;
        let y = 0;

        for(let point of points){
            x += point.x;
            y += point.y;
        }

        return {
            x:x / points.length,
            y:y / points.length
        };
    }

    eStep(data,components){
        let responsibilities = [];

        for(let point of data){
            let row = [];
            let total = 0;

            for(let component of components){
                let value = component.weight * GMM.gaussian(point,component.mean,component.cov);
                row.push(value);
                total += value;
            }

            if(total === 0 || !Number.isFinite(total)){
                row = row.map(() => 1 / components.length);
            }else{
                row = row.map((value) => value / total);
            }

            responsibilities.push(row);
        }

        return responsibilities;
    }

    mStep(data,responsibilities,k){
        let components = [];

        for(let componentIndex = 0;componentIndex < k;componentIndex++){
            let nk = 0;
            let mean = {x:0,y:0};

            for(let i = 0;i < data.length;i++){
                let resp = responsibilities[i][componentIndex];
                nk += resp;
                mean.x += resp * data[i].x;
                mean.y += resp * data[i].y;
            }

            if(nk <= 0.000001){
                let randomPoint = data[parseInt(Math.random() * data.length)];
                components.push({
                    weight:1 / k,
                    mean:{x:randomPoint.x,y:randomPoint.y},
                    cov:this.globalCovariance(data)
                });
                continue;
            }

            mean.x = mean.x / nk;
            mean.y = mean.y / nk;

            let cov = {a:0,b:0,c:0};

            for(let i = 0;i < data.length;i++){
                let resp = responsibilities[i][componentIndex];
                let dx = data[i].x - mean.x;
                let dy = data[i].y - mean.y;

                cov.a += resp * dx * dx;
                cov.b += resp * dx * dy;
                cov.c += resp * dy * dy;
            }

            cov.a = cov.a / nk + this.regularizer;
            cov.b = cov.b / nk;
            cov.c = cov.c / nk + this.regularizer;

            if(cov.a < 9){
                cov.a = 9;
            }

            if(cov.c < 9){
                cov.c = 9;
            }

            components.push({
                weight:nk / data.length,
                mean:mean,
                cov:cov
            });
        }

        return components;
    }

    buildResult(data,responsibilities,iterations,logLikelihood){
        let assignment = this.assignCluster(data,responsibilities,this.components.length);

        return {
            components:this.cloneComponents(this.components),
            clusters:assignment.clusters,
            confidence:assignment.confidence,
            responsibilities:responsibilities.map((row) => row.slice()),
            iterations:iterations,
            logLikelihood:logLikelihood
        };
    }

    assignCluster(data,responsibilities,k){
        let clusters = [];
        let confidence = [];

        for(let i = 0;i < k;i++){
            clusters.push([]);
        }

        for(let i = 0;i < data.length;i++){
            let candidate = 0;
            let maxResp = -Infinity;

            for(let j = 0;j < k;j++){
                if(responsibilities[i][j] > maxResp){
                    maxResp = responsibilities[i][j];
                    candidate = j;
                }
            }

            clusters[candidate].push(data[i]);
            confidence.push(maxResp);
        }

        return {
            clusters:clusters,
            confidence:confidence
        };
    }

    logLikelihood(data,components){
        let value = 0;

        for(let point of data){
            let total = 0;

            for(let component of components){
                total += component.weight * GMM.gaussian(point,component.mean,component.cov);
            }

            value += Math.log(Math.max(total,1e-12));
        }

        return value;
    }

    cloneComponents(components){
        return components.map((component) => ({
            weight:component.weight,
            mean:{x:component.mean.x,y:component.mean.y},
            cov:{a:component.cov.a,b:component.cov.b,c:component.cov.c}
        }));
    }

    static gaussian(point,mean,cov){
        let a = cov.a;
        let b = cov.b;
        let c = cov.c;
        let det = a * c - b * b;

        if(det <= 0 || !Number.isFinite(det)){
            det = 0.0001;
        }

        let dx = point.x - mean.x;
        let dy = point.y - mean.y;
        let invA = c / det;
        let invB = -b / det;
        let invC = a / det;
        let exponent = -0.5 * (invA * dx * dx + 2 * invB * dx * dy + invC * dy * dy);
        let normalizer = 1 / (2 * Math.PI * Math.sqrt(det));

        return normalizer * Math.exp(exponent);
    }
}

/*
    DBSCAN.
    Looks for dense areas using epsilon and MinPTS. Points can be core,
    border or noise, without choosing the number of clusters first.
*/
class DBSCAN{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.eps = 0;
        this.minPts = 0;
        this.steps = [];
    }

    run(data,eps,minPts){
        this.eps = eps;
        this.minPts = minPts;

        /* Copy points and add the original index: this helps recognize them during the visit. */
        let dataset = data.map((point,index) => ({
            x:point.x,
            y:point.y,
            i:index
        }));

        let clusters = [];
        let border = [];
        let noise = [];
        let core = [];
        let visited = new Set();
        let steps = [];
        let neighborCounts = dataset.map((point) => this.regionQuery(dataset,point).length);

        for(let [i,point] of dataset.entries()){
            if(visited.has(i)){
                continue;
            }

            visited.add(i);

            let neighbours = this.regionQuery(dataset,point);

            if(neighbours.length < this.minPts){
                point.label = "noise";

                if(!isInArray(noise,point)){
                    noise.push(point);
                }
            }else{
                let newCluster = this.expandCluster(dataset,point,neighbours,visited,border,core,clusters);
                clusters.push(newCluster);
            }

            steps.push(this.snapshot(core,clusters,noise,border,neighborCounts));
        }

        let finalNoise = noise.filter((point) => !isInCluster(clusters,point));

        this.steps = steps;

        return {
            core:core,
            clusters:clusters,
            noise:finalNoise,
            border:border,
            eps:this.eps,
            neighborCounts:neighborCounts,
            steps:steps
        };
    }

    expandCluster(dataset,point,neighbours,visited,border,core,clusters){
        let cluster = [];
        let queue = neighbours.slice();

        point.label = "core";
        cluster.push(point);

        if(!isInArray(core,point)){
            core.push(point);
        }

        for(let i = 0;i < queue.length;i++){
            let neighbour = queue[i];
            let neighbourIndex = dataset.indexOf(neighbour);

            if(!visited.has(neighbourIndex)){
                visited.add(neighbourIndex);

                let neighbourPoints = this.regionQuery(dataset,neighbour);

                if(neighbourPoints.length >= this.minPts){
                    neighbour.label = "core";

                    if(!isInArray(core,neighbour)){
                        core.push(neighbour);
                    }

                    for(let neighbourPoint of neighbourPoints){
                        if(!queue.includes(neighbourPoint)){
                            queue.push(neighbourPoint);
                        }
                    }
                }else{
                    neighbour.label = "border";

                    if(!isInArray(border,neighbour)){
                        border.push(neighbour);
                    }
                }
            }

            if(neighbour.label === "noise"){
                neighbour.label = "border";

                if(!isInArray(border,neighbour)){
                    border.push(neighbour);
                }
            }

            if(!isInCluster(clusters,neighbour) && !isInArray(cluster,neighbour)){
                cluster.push(neighbour);
            }
        }

        return cluster;
    }

    regionQuery(dataset,point){
        let neighbours = [];

        for(let neighbour of dataset){
            if(euclidianDistance(point,neighbour) <= this.eps){
                neighbours.push(neighbour);
            }
        }

        return neighbours;
    }

    snapshot(core,clusters,noise,border,neighborCounts){
        let visibleNoise = noise.filter((point) => !isInCluster(clusters,point));

        return {
            core: core.slice(),
            clusters: clusters.map((cluster) => cluster.slice()),
            noise: visibleNoise,
            border: border.slice(),
            eps: this.eps,
            neighborCounts: neighborCounts.slice()
        };
    }
}

/*
    Educational HDBSCAN.
    Starts from core distances, builds mutual reachability and MST,
    then tries different cuts and chooses the one with the best simplified stability.
*/
class HDBSCAN{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,minPts,minClusterSize){
        /* Keep the original index to connect calculations and drawing. */
        let dataset = data.map((point,index) => ({
            x:point.x,
            y:point.y,
            i:index
        }));

        let coreDistances = this.calculateCoreDistances(dataset,minPts);
        let edges = this.calculateMutualReachability(dataset,coreDistances);
        let mst = this.calculateMST(dataset,edges);
        let thresholds = [...new Set(mst.map((edge) => edge.weight))]
            .sort((a,b) => b - a);

        if(thresholds.length === 0){
            thresholds = [0];
        }

        let steps = [];
        let bestResult = null;
        let bestStability = -Infinity;

        steps.push({
            phase:"core",
            phaseLabel:"1. Core distance: radius of the minPts neighbor",
            clusters:[],
            noise:dataset,
            coreDistances:coreDistances,
            mst:[],
            threshold:0
        });

        steps.push({
            phase:"mutual",
            phaseLabel:"2. Mutual reachability: density-weighted edges",
            clusters:[],
            noise:dataset,
            coreDistances:coreDistances,
            reachabilityEdges:edges,
            mst:[],
            threshold:0
        });

        steps.push({
            phase:"mst",
            phaseLabel:"3. MST: minimum skeleton of mutual reachability",
            clusters:[],
            noise:dataset,
            coreDistances:coreDistances,
            mst:mst,
            threshold:0
        });

        for(let [index,threshold] of thresholds.entries()){
            let result = this.cutMST(dataset,mst,threshold,minClusterSize);
            result.coreDistances = coreDistances;
            result.mst = mst;
            result.threshold = threshold;
            result.phase = "cut";
            result.phaseLabel = this.getThresholdLabel(index,thresholds.length,threshold);
            result.stability = this.calculateStability(result,mst);
            result.steps = steps;
            steps.push(result);

            if(result.stability > bestStability){
                bestStability = result.stability;
                bestResult = result;
            }
        }

        this.steps = steps;

        if(!bestResult){
            bestResult = this.cutMST(dataset,mst,thresholds[0],minClusterSize);
            bestResult.coreDistances = coreDistances;
            bestResult.mst = mst;
            bestResult.threshold = thresholds[0];
            bestResult.stability = this.calculateStability(bestResult,mst);
        }

        let selectedResult = this.cloneResult(bestResult);
        selectedResult.phase = "selected";
        selectedResult.phaseLabel = `7. Selected clusters: maximum simplified stability`;
        selectedResult.steps = steps;
        steps.push(selectedResult);
        return selectedResult;
    }

    cloneResult(result){
        return {
            phase:result.phase,
            phaseLabel:result.phaseLabel,
            clusters:result.clusters.map((cluster) => cluster.slice()),
            noise:result.noise.slice(),
            threshold:result.threshold,
            mst:result.mst,
            coreDistances:result.coreDistances,
            reachabilityEdges:result.reachabilityEdges,
            stability:result.stability
        };
    }

    getThresholdLabel(index,total,threshold){
        let zone = "medium";
        let stepNumber = 5;

        if(index === 0){
            zone = "high";
            stepNumber = 4;
        }else if(index === total - 1){
            zone = "low";
            stepNumber = 6;
        }

        return `${stepNumber}. ${zone} threshold cut: ${threshold.toFixed(2)}`;
    }

    calculateCoreDistances(data,minPts){
        let coreDistances = [];

        for(let point of data){
            let distances = [];

            for(let other of data){
                if(point === other){
                    continue;
                }

                distances.push(euclidianDistance(point,other));
            }

            distances.sort((a,b) => a - b);

            let idx = Math.max(0,Math.min(distances.length - 1,minPts - 1));
            coreDistances.push(distances[idx] || 0);
        }

        return coreDistances;
    }

    calculateMutualReachability(data,coreDistances){
        let edges = [];

        for(let i = 0;i < data.length;i++){
            for(let j = i + 1;j < data.length;j++){
                let distance = euclidianDistance(data[i],data[j]);
                let weight = Math.max(coreDistances[i],coreDistances[j],distance);

                edges.push({
                    from:i,
                    to:j,
                    a:data[i],
                    b:data[j],
                    weight:weight
                });
            }
        }

        return edges;
    }

    calculateMST(data,edges){
        let parent = data.map((_,index) => index);
        let mst = [];
        let sorted = edges.slice().sort((a,b) => a.weight - b.weight);

        let find = (x) => {
            while(parent[x] !== x){
                parent[x] = parent[parent[x]];
                x = parent[x];
            }

            return x;
        };

        let union = (a,b) => {
            let rootA = find(a);
            let rootB = find(b);

            if(rootA === rootB){
                return false;
            }

            parent[rootB] = rootA;
            return true;
        };

        for(let edge of sorted){
            if(union(edge.from,edge.to)){
                mst.push(edge);
            }
        }

        return mst;
    }

    cutMST(data,mst,threshold,minClusterSize){
        let parent = data.map((_,index) => index);

        let find = (x) => {
            while(parent[x] !== x){
                parent[x] = parent[parent[x]];
                x = parent[x];
            }

            return x;
        };

        let union = (a,b) => {
            let rootA = find(a);
            let rootB = find(b);

            if(rootA !== rootB){
                parent[rootB] = rootA;
            }
        };

        for(let edge of mst){
            if(edge.weight <= threshold){
                union(edge.from,edge.to);
            }
        }

        let groups = new Map();

        for(let i = 0;i < data.length;i++){
            let root = find(i);

            if(!groups.has(root)){
                groups.set(root,[]);
            }

            groups.get(root).push(data[i]);
        }

        let clusters = [];
        let noise = [];

        for(let group of groups.values()){
            if(group.length >= minClusterSize){
                clusters.push(group);
            }else{
                noise = noise.concat(group);
            }
        }

        return {
            clusters:clusters,
            noise:noise,
            threshold:threshold,
            mst:mst
        };
    }

    calculateStability(result,mst){
        let stability = 0;
        let lambdaNow = 1 / Math.max(result.threshold,0.0001);

        for(let cluster of result.clusters){
            let ids = new Set(cluster.map((point) => point.i));
            let exitDistance = Infinity;

            for(let edge of mst){
                let fromInside = ids.has(edge.from);
                let toInside = ids.has(edge.to);

                if(fromInside !== toInside && edge.weight > result.threshold){
                    exitDistance = Math.min(exitDistance,edge.weight);
                }
            }

            if(exitDistance === Infinity){
                exitDistance = Math.max(...mst.map((edge) => edge.weight),result.threshold);
            }

            let lambdaBirth = 1 / Math.max(exitDistance,0.0001);
            stability += cluster.length * Math.max(0,lambdaNow - lambdaBirth);
        }

        return stability;
    }
}

/*
    Agglomerative hierarchical clustering.
    Starts with one cluster per point and repeatedly merges the two closest clusters,
    keeping the history to show the dendrogram and iterations.
*/
class HCluster{
    constructor(canvasHandler){
        this.canvasHandler = canvasHandler;
        this.steps = [];
    }

    run(data,linkage,metric){
        /* nextId creates stable names: sub-clusters stay recognizable across steps. */
        let nextId = 0;
        let initClusters = data.length;
        let allClusters = [];
        let steps = [];
        let clusters = data.map((point,index) => {
            let cluster = {
                id:++nextId,
                tree:[],
                points:[{x:point.x,y:point.y,i:index}],
                centroid:{x:point.x,y:point.y},
                level:0,
                mergeDistance:0
            };

            allClusters.push(this.cloneCluster(cluster));
            return cluster;
        });

        let iterations = 0;

        while(clusters.length > 1){
            let closestPair = this.findClosestPair(clusters,linkage,metric);

            if(!closestPair){
                break;
            }

            iterations++;

            let mergedCluster = this.mergeClusters(
                closestPair.first,
                closestPair.second,
                ++nextId,
                closestPair.distance,
                iterations
            );

            clusters = clusters
                .filter((cluster) => cluster.id !== closestPair.first.id && cluster.id !== closestPair.second.id)
                .concat(mergedCluster);

            allClusters.push(this.cloneCluster(mergedCluster));

            steps.push({
                allClusters: allClusters.map((cluster) => this.cloneCluster(cluster)),
                currentClusters: clusters.map((cluster) => this.cloneCluster(cluster)),
                initClusters:initClusters,
                iterations:iterations,
                linkage:linkage,
                metric:metric,
                merged:[closestPair.first.id,closestPair.second.id],
                mergeDistance:closestPair.distance
            });
        }

        this.steps = steps;

        return {
            allClusters:allClusters,
            currentClusters:clusters,
            initClusters:initClusters,
            steps:steps,
            iterations:iterations,
            linkage:linkage,
            metric:metric
        };
    }

    findClosestPair(clusters,linkage,metric){
        let bestPair = null;
        let bestDistance = Infinity;

        for(let i = 0;i < clusters.length;i++){
            for(let j = i + 1;j < clusters.length;j++){
                let distance = this.clusterDistance(clusters[i],clusters[j],linkage,metric);

                if(distance < bestDistance){
                    bestDistance = distance;
                    bestPair = {
                        first:clusters[i],
                        second:clusters[j],
                        distance:distance
                    };
                }
            }
        }

        return bestPair;
    }

    mergeClusters(firstCluster,secondCluster,nextId,mergeDistance,level){
        let points = firstCluster.points.concat(secondCluster.points);

        return {
            id:nextId,
            tree:[firstCluster.id,secondCluster.id],
            points:points,
            centroid:this.calculateCentroid(points),
            level:level,
            mergeDistance:mergeDistance
        };
    }

    clusterDistance(firstCluster,secondCluster,linkage,metric){
        if(linkage === "complete"){
            return this.completeLink(firstCluster.points,secondCluster.points,metric);
        }

        if(linkage === "average"){
            return this.averageLink(firstCluster.points,secondCluster.points,metric);
        }

        if(linkage === "centroid"){
            return this.pointDistance(firstCluster.centroid,secondCluster.centroid,metric);
        }

        if(linkage === "ward"){
            return this.wardDistance(firstCluster,secondCluster);
        }

        return this.singleLink(firstCluster.points,secondCluster.points,metric);
    }

    singleLink(firstPoints,secondPoints,metric){
        let min = Infinity;

        for(let firstPoint of firstPoints){
            for(let secondPoint of secondPoints){
                let value = this.pointDistance(firstPoint,secondPoint,metric);

                if(value < min){
                    min = value;
                }
            }
        }

        return min;
    }

    completeLink(firstPoints,secondPoints,metric){
        let max = -Infinity;

        for(let firstPoint of firstPoints){
            for(let secondPoint of secondPoints){
                let value = this.pointDistance(firstPoint,secondPoint,metric);

                if(value > max){
                    max = value;
                }
            }
        }

        return max;
    }

    averageLink(firstPoints,secondPoints,metric){
        let value = 0;

        for(let firstPoint of firstPoints){
            for(let secondPoint of secondPoints){
                value += this.pointDistance(firstPoint,secondPoint,metric);
            }
        }

        return value / (firstPoints.length * secondPoints.length);
    }

    wardDistance(firstCluster,secondCluster){
        let centroidDistance = this.pointDistance(firstCluster.centroid,secondCluster.centroid,"euclidean");
        let sizeFactor = (firstCluster.points.length * secondCluster.points.length) /
            (firstCluster.points.length + secondCluster.points.length);

        return sizeFactor * Math.pow(centroidDistance,2);
    }

    pointDistance(firstPoint,secondPoint,metric){
        let dx = Math.abs(secondPoint.x - firstPoint.x);
        let dy = Math.abs(secondPoint.y - firstPoint.y);

        if(metric === "manhattan"){
            return dx + dy;
        }

        if(metric === "chebyshev"){
            return Math.max(dx,dy);
        }

        if(metric === "minkowski3"){
            return Math.pow(Math.pow(dx,3) + Math.pow(dy,3),1 / 3);
        }

        if(metric === "cosine"){
            let dot = firstPoint.x * secondPoint.x + firstPoint.y * secondPoint.y;
            let firstNorm = Math.sqrt(firstPoint.x * firstPoint.x + firstPoint.y * firstPoint.y);
            let secondNorm = Math.sqrt(secondPoint.x * secondPoint.x + secondPoint.y * secondPoint.y);

            if(firstNorm === 0 || secondNorm === 0){
                return 1;
            }

            return 1 - dot / (firstNorm * secondNorm);
        }

        return euclidianDistance(firstPoint,secondPoint);
    }

    calculateCentroid(points){
        let xAvg = 0;
        let yAvg = 0;

        for(let point of points){
            xAvg += point.x;
            yAvg += point.y;
        }

        return {
            x:xAvg / points.length,
            y:yAvg / points.length
        };
    }

    cloneCluster(cluster){
        return {
            id:cluster.id,
            tree:cluster.tree.slice(),
            points:cluster.points.map((point) => ({...point})),
            centroid:{...cluster.centroid},
            level:cluster.level,
            mergeDistance:cluster.mergeDistance
        };
    }
}

/*
    AppController connects everything:
    reads sidebar controls, calls the selected algorithm,
    updates status/legend and asks CanvasHandler to redraw.
*/
class AppController{
    constructor(){
        this.canvasHandler = new CanvasHandler(DOM("clusterCanvas"));
        this.mode = "kmeans";
        this.data = [];
        this.currentResult = null;
        this.currentSteps = [];
        this.stepIndex = 0;
        this.metricsReady = false;

        this.kmeans = new kMeans(this.canvasHandler);
        this.spectral = new SpectralClustering(this.canvasHandler);
        this.fuzzy = new FuzzyCMeans(this.canvasHandler);
        this.meanShift = new MeanShift(this.canvasHandler);
        this.gmm = new GMM(this.canvasHandler);
        this.dbscan = new DBSCAN(this.canvasHandler);
        this.hdbscan = new HDBSCAN(this.canvasHandler);
        this.hcluster = new HCluster(this.canvasHandler);

        this.bindEvents();
        this.updateRangeValues();
        this.updateLegend();
        this.updatePseudocode();
        this.updateQualityLegend();
        this.render();
    }

    bindEvents(){
        /* All UI events live here, so the rest of the code stays focused on the algorithms. */
        window.addEventListener("resize",() => {
            this.canvasHandler.resize();
            this.render();
        });

        this.canvasHandler.canvas.addEventListener("click",(event) => {
            this.data.push(this.canvasHandler.getMouse(event));
            this.clearResult();
            this.setStatus(`Points: ${this.data.length}`);
            this.render();
        });

        this.canvasHandler.canvas.addEventListener("contextmenu",(event) => {
            event.preventDefault();

            if(this.mode !== "kmeans"){
                return;
            }

            this.kmeans.init_centroid.push(this.canvasHandler.getMouse(event));
            this.clearResult();
            this.setStatus(`Centroids: ${this.kmeans.init_centroid.length}`);
            this.render();
        });

        document.querySelectorAll("[data-mode]").forEach((button) => {
            button.addEventListener("click",() => this.changeMode(button.dataset.mode));
        });

        DOM("algorithmSelect").addEventListener("change",() => {
            this.changeMode(DOMgetValue("algorithmSelect"));
        });

        this.bindRange("noiseCount","noiseCountValue");
        this.bindRange("clusterCount","clusterCountValue");
        this.bindRange("clusterSize","clusterSizeValue");
        this.bindRange("clusterSpread","clusterSpreadValue");

        DOM("addNoisePoints").addEventListener("click",() => {
            let count = parseInt(DOMgetValue("clusterSize"));
            let points = generateNoisePoints(count,this.canvasHandler.width,this.canvasHandler.height);

            this.data = this.data.concat(points);
            this.clearResult();
            this.setStatus(`Added ${points.length} noise points`);
            this.render();
        });

        DOM("addRandomClusters").addEventListener("click",() => {
            let clusterCount = parseInt(DOMgetValue("clusterCount"));
            let pointCount = parseInt(DOMgetValue("clusterSize"));
            let clusterSpread = parseInt(DOMgetValue("clusterSpread"));
            let noisePercent = parseInt(DOMgetValue("noiseCount"));
            let points = generateRandomClusters(
                clusterCount,
                pointCount,
                clusterSpread,
                noisePercent,
                this.canvasHandler.width,
                this.canvasHandler.height
            );

            this.data = this.data.concat(points);
            this.clearResult();
            this.setStatus(`Added ${points.length} points in ${clusterCount} clusters, noise ${noisePercent}%`);
            this.render();
        });

        DOM("addTwoMoons").addEventListener("click",() => {
            let count = parseInt(DOMgetValue("clusterSize"));
            let spread = parseInt(DOMgetValue("clusterSpread"));
            let noisePercent = parseInt(DOMgetValue("noiseCount"));
            let points = generateTwoMoons(count,this.canvasHandler.width,this.canvasHandler.height,spread,noisePercent);

            this.data = this.data.concat(points);
            this.clearResult();
            this.setStatus(`Added two moons dataset: ${points.length} points, noise ${noisePercent}%, spread ${spread}`);
            this.render();
        });

        DOM("addCircles").addEventListener("click",() => {
            let count = parseInt(DOMgetValue("clusterSize"));
            let spread = parseInt(DOMgetValue("clusterSpread"));
            let noisePercent = parseInt(DOMgetValue("noiseCount"));
            let points = generateConcentricCircles(count,this.canvasHandler.width,this.canvasHandler.height,spread,noisePercent);

            this.data = this.data.concat(points);
            this.clearResult();
            this.setStatus(`Added concentric circles dataset: ${points.length} points, noise ${noisePercent}%, spread ${spread}`);
            this.render();
        });

        DOM("addSpiral").addEventListener("click",() => {
            let count = parseInt(DOMgetValue("clusterSize"));
            let spread = parseInt(DOMgetValue("clusterSpread"));
            let noisePercent = parseInt(DOMgetValue("noiseCount"));
            let points = generateSpiral(count,this.canvasHandler.width,this.canvasHandler.height,spread,noisePercent);

            this.data = this.data.concat(points);
            this.clearResult();
            this.setStatus(`Added spiral dataset: ${points.length} points, noise ${noisePercent}%, spread ${spread}`);
            this.render();
        });

        DOM("resetPoints").addEventListener("click",() => {
            this.data = [];
            this.kmeans.reset();
            this.clearResult();
            this.setStatus("Points removed");
            this.render();
        });

        DOM("clearResult").addEventListener("click",() => {
            this.clearResult();
            this.setStatus("Result cleared");
            this.render();
        });

        DOM("showBoundaries").addEventListener("change",() => this.render());
        DOM("showDetails").addEventListener("change",() => this.render());
        DOM("showTrails").addEventListener("change",() => this.render());
        DOM("showLegend").addEventListener("change",() => this.updateLegend());
        DOM("meanShiftDensityMap").addEventListener("change",() => this.render());
        DOM("dbscanDrawEps").addEventListener("change",() => this.render());

        DOM("playAlgorithm").addEventListener("click",() => this.runCurrent(false));
        DOM("stepAlgorithm").addEventListener("click",() => this.runCurrent(true));

        DOM("randomCentroids").addEventListener("click",() => {
            let k = this.readPositiveInt("kValue","Invalid K");

            if(!k){
                return;
            }

            this.kmeans.generateInitCentroids(k);
            this.clearResult();
            this.setStatus(`Generated centroids: ${this.kmeans.init_centroid.length}`);
            this.render();
        });

        DOM("kppCentroids").addEventListener("click",() => {
            let k = this.readPositiveInt("kValue","Invalid K");

            if(!k || !this.checkData()){
                return;
            }

            this.kmeans.kppCentroids(this.data,k);
            this.clearResult();
            this.setStatus(`KMeans++ centroids: ${this.kmeans.init_centroid.length}`);
            this.render();
        });

        DOM("runKmeans").addEventListener("click",() => this.runKMeans(false));
        DOM("stepKmeans").addEventListener("click",() => this.runKMeans(true));

        DOM("resetKmeans").addEventListener("click",() => {
            this.kmeans.reset();
            this.clearResult();
            this.setStatus("Centroids removed");
            this.render();
        });

        DOM("runDbscan").addEventListener("click",() => this.runDBSCAN(false));
        DOM("stepDbscan").addEventListener("click",() => this.runDBSCAN(true));

        DOM("runSpectral").addEventListener("click",() => this.runSpectral(false));
        DOM("stepSpectral").addEventListener("click",() => this.runSpectral(true));

        DOM("runFuzzy").addEventListener("click",() => this.runFuzzy(false));
        DOM("stepFuzzy").addEventListener("click",() => this.runFuzzy(true));

        DOM("runMeanShift").addEventListener("click",() => this.runMeanShift(false));
        DOM("stepMeanShift").addEventListener("click",() => this.runMeanShift(true));

        DOM("runGmm").addEventListener("click",() => this.runGMM(false));
        DOM("stepGmm").addEventListener("click",() => this.runGMM(true));

        DOM("runHdbscan").addEventListener("click",() => this.runHDBSCAN(false));
        DOM("stepHdbscan").addEventListener("click",() => this.runHDBSCAN(true));

        DOM("runHcluster").addEventListener("click",() => this.runHCluster(false));
        DOM("stepHcluster").addEventListener("click",() => this.runHCluster(true));
    }

    bindRange(inputId,labelId){
        DOM(inputId).addEventListener("input",() => {
            this.updateRangeLabel(inputId,labelId);
        });
    }

    updateRangeValues(){
        this.updateRangeLabel("noiseCount","noiseCountValue");
        this.updateRangeLabel("clusterCount","clusterCountValue");
        this.updateRangeLabel("clusterSize","clusterSizeValue");
        this.updateRangeLabel("clusterSpread","clusterSpreadValue");
    }

    updateRangeLabel(inputId,labelId){
        let value = DOMgetValue(inputId);

        if(inputId === "noiseCount"){
            value = `${value}%`;
        }

        DOMsetValue(labelId,value);
    }

    changeMode(mode){
        this.mode = mode;
        this.clearResult();
        DOM("algorithmSelect").value = mode;

        document.querySelectorAll("[data-mode]").forEach((button) => {
            button.classList.toggle("active",button.dataset.mode === mode);
        });

        document.querySelectorAll("[data-panel]").forEach((panel) => {
            panel.classList.toggle("hidden",panel.dataset.panel !== mode);
        });

        this.setStatus(`Mode: ${mode}`);
        this.updateLegend();
        this.updatePseudocode();
        this.render();
    }

    runCurrent(isStep){
        /* Play and Step are shared: only the called function changes based on the algorithm menu. */
        if(this.mode === "kmeans"){
            this.runKMeans(isStep);
            return;
        }

        if(this.mode === "dbscan"){
            this.runDBSCAN(isStep);
            return;
        }

        if(this.mode === "spectral"){
            this.runSpectral(isStep);
            return;
        }

        if(this.mode === "fuzzy"){
            this.runFuzzy(isStep);
            return;
        }

        if(this.mode === "meanshift"){
            this.runMeanShift(isStep);
            return;
        }

        if(this.mode === "gmm"){
            this.runGMM(isStep);
            return;
        }

        if(this.mode === "hdbscan"){
            this.runHDBSCAN(isStep);
            return;
        }

        this.runHCluster(isStep);
    }

    getLegendItems(){
        /* The legend is dynamic: it only explains symbols used by the selected algorithm. */
        if(this.mode === "kmeans"){
            return [
                "Red cross = initial centroids",
                "Green cross = final centroids",
                "Background = nearest-centroid region"
            ];
        }

        if(this.mode === "gmm"){
            return [
                "Ellipse = Gaussian covariance",
                "Cross = component mean",
                "Transparency = point confidence"
            ];
        }

        if(this.mode === "dbscan"){
            return [
                "Color = cluster",
                "Purple = border point",
                "Black = noise",
                "Circle = epsilon range"
            ];
        }

        if(this.mode === "meanshift"){
            return [
                "Colored points = final cluster",
                "Cross = mode / density maximum",
                "Circle = bandwidth",
                "Trail = shift toward density",
                "Curves = density function levels",
                "Colored bands = KDE intensity",
                "Gray = micro-cluster or noise"
            ];
        }

        if(this.mode === "hdbscan"){
            return [
                "Lines = MST on mutual reachability",
                "Circles = selected clusters",
                "Black = noise",
                "Threshold = density level in the step"
            ];
        }

        if(this.mode === "spectral"){
            return [
                "Graph / affinity = similarity between points",
                "Normalized Laplacian = transformed space",
                "Colors = final clusters after K-Means"
            ];
        }

        if(this.mode === "fuzzy"){
            return [
                "Transparency = maximum membership",
                "Cross = centroid",
                "Soft colors = soft membership"
            ];
        }

        return [
            "Link = distance between sub-clusters",
            "C/P labels = clusters and points kept in the steps",
            "Final tree = complete hierarchy"
        ];
    }

    updateLegend(){
        let legend = DOM("legendText");

        if(!DOM("showLegend").checked){
            legend.innerHTML = "<li>Legend hidden</li>";
            return;
        }

        legend.innerHTML = this.getLegendItems()
            .map((item) => `<li>${item}</li>`)
            .join("");
    }

    getPseudocode(){
        if(this.mode === "kmeans"){
            return `let centroids = chooseInitialCentroids(data, k);
let converged = false;

while (!converged) {
  const oldCentroids = centroids;

  const clusters = assignPoints(data, centroids);
  centroids = updateCentroids(clusters);

  converged = hasConverged(oldCentroids, centroids);
}`;
        }

        if(this.mode === "spectral"){
            return `let W = buildAffinityMatrix(data, sigma);
let L = normalizedLaplacian(W);

let vectors = topEigenvectors(L, k);
let embedding = buildEmbedding(vectors);

return kMeans(embedding, k);`;
        }

        if(this.mode === "fuzzy"){
            return `let membership = randomMembership(data, k);
let centroids;

for (let i = 0; i < maxIterations; i++) {
  const oldMembership = membership;

  centroids = updateWeightedCentroids(data, membership);
  membership = updateMemberships(data, centroids);

  if (hasConverged(oldMembership, membership)) {
    break;
  }
}

return strongestMembership(membership);`;
        }

        if(this.mode === "meanshift"){
            return `let shifted = copyPoints(data);
let stable = false;

while (!stable) {
  stable = true;

  for (let i = 0; i < shifted.length; i++) {
    let neighbors = pointsWithinBandwidth(shifted[i], shifted);
    let newPoint = weightedMean(neighbors);

    if (distance(shifted[i], newPoint) > tolerance) {
      stable = false;
    }

    shifted[i] = newPoint;
  }
}

let modes = mergeNearbyPoints(shifted);
return assignPointsToModes(data, modes);`;
        }

        if(this.mode === "gmm"){
            return `let components = initializeGaussians(data, k);
let responsibilities;

for (let i = 0; i < maxIterations; i++) {
  const oldComponents = components;

  responsibilities = estimateMemberships(data, components);
  components = updateGaussians(data, responsibilities);

  if (hasConverged(oldComponents, components)) {
    break;
  }
}

return mostLikelyComponent(responsibilities);`;
        }

        if(this.mode === "dbscan"){
            return `let clusterId = 0;

for (let point of data) {
  if (point.visited) continue;

  point.visited = true;
  let neighbors = regionQuery(point, epsilon);

  if (neighbors.length < minPts) {
    markAsNoise(point);
  } else {
    clusterId++;
    expandCluster(point, neighbors, clusterId, epsilon, minPts);
  }
}`;
        }

        if(this.mode === "hdbscan"){
            return `let coreDistances = computeCoreDistances(data, minPts);
let graph = mutualReachabilityGraph(data, coreDistances);

let mst = minimumSpanningTree(graph);
let condensedTree = condenseTree(mst, minClusterSize);

let clusters = extractMostStableClusters(condensedTree);

return clusters;`;
        }

        return `let clusters = data.map(point => [point]);
let merges = [];

while (clusters.length > 1) {
  let pair = findClosestClusters(clusters);
  let distance = clusterDistance(pair[0], pair[1]);

  merges.push({ pair, distance });

  clusters = mergePair(clusters, pair);
}

return buildDendrogram(merges);`;
    }

    escapeHtml(text){
        return text
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;");
    }

    pseudocodeToken(type,value){
        return `<span class="token-${type}">${this.escapeHtml(value)}</span>`;
    }

    highlightPseudocode(code){
        let keywords = new Set([
            "let","const","return","while","for","if","else","continue","break","of"
        ]);
        let constants = new Set(["true","false","null","undefined"]);
        let html = "";
        let i = 0;

        while(i < code.length){
            let char = code[i];

            if(/\s/.test(char)){
                html += char;
                i++;
                continue;
            }

            if(char === "\"" || char === "'"){
                let quote = char;
                let j = i + 1;

                while(j < code.length && code[j] !== quote){
                    if(code[j] === "\\"){
                        j++;
                    }

                    j++;
                }

                html += this.pseudocodeToken("string",code.slice(i,Math.min(j + 1,code.length)));
                i = Math.min(j + 1,code.length);
                continue;
            }

            if(/[0-9]/.test(char)){
                let j = i + 1;

                while(j < code.length && /[0-9.]/.test(code[j])){
                    j++;
                }

                html += this.pseudocodeToken("number",code.slice(i,j));
                i = j;
                continue;
            }

            if(/[A-Za-z_$]/.test(char)){
                let j = i + 1;

                while(j < code.length && /[A-Za-z0-9_$]/.test(code[j])){
                    j++;
                }

                let word = code.slice(i,j);
                let next = j;
                let previous = i - 1;

                while(next < code.length && /\s/.test(code[next])){
                    next++;
                }

                while(previous >= 0 && /\s/.test(code[previous])){
                    previous--;
                }

                if(keywords.has(word)){
                    html += this.pseudocodeToken("keyword",word);
                }else if(constants.has(word)){
                    html += this.pseudocodeToken("number",word);
                }else if(code[previous] === "."){
                    html += this.pseudocodeToken("property",word);
                }else if(code[next] === "("){
                    html += this.pseudocodeToken("function",word);
                }else{
                    html += this.pseudocodeToken("variable",word);
                }

                i = j;
                continue;
            }

            if("+-*/=%!<>|&".includes(char)){
                let nextChar = code[i + 1] || "";
                let value = char;

                if("=><&|".includes(nextChar)){
                    value += nextChar;
                    i++;
                }

                html += this.pseudocodeToken("operator",value);
                i++;
                continue;
            }

            html += this.pseudocodeToken("punctuation",char);
            i++;
        }

        return html;
    }

    updatePseudocode(){
        let box = DOM("pseudocodeBox");

        if(!box){
            return;
        }

        box.innerHTML = this.highlightPseudocode(this.getPseudocode());
    }

    updateMetrics(){
        let panel = DOM("metricsPanel");

        if(!panel){
            return;
        }

        this.updateQualityLegend();

        if(!this.metricsReady || !this.currentResult){
            panel.innerHTML = "<p class=\"hint\">Metrics will appear after Play or after the last Step.</p>";
            return;
        }

        let metrics = this.calculateMetrics();

        if(metrics.length === 0){
            panel.innerHTML = "<p class=\"hint\">Metrics are not available for this result.</p>";
            return;
        }

        panel.innerHTML = metrics.map((metric) => {
            let dot = metric.quality === "plain"
                ? `<span class="metric-trend" aria-label="${metric.title}">${metric.trend || ""}</span>`
                : `<span class="metric-dot" aria-label="${metric.title}"></span>`;

            return `
                <div class="metric-item quality-${metric.quality}" title="${metric.title}">
                    <span class="metric-name">${metric.name}</span>
                    <span class="metric-value">${metric.value}</span>
                    ${dot}
                </div>
            `;
        }).join("");
    }

    updateQualityLegend(){
        let legend = DOM("qualityLegend");

        if(!legend){
            return;
        }

        if(this.mode === "gmm"){
            legend.innerHTML = `
                <span>higher = better</span>
                <span>lower = better</span>
                <span>hover a metric to see the tooltip</span>
            `;
            return;
        }

        legend.innerHTML = `
            <span><i class="good-dot"></i> green good</span>
            <span><i class="medium-dot"></i> yellow medium</span>
            <span><i class="bad-dot"></i> red weak</span>
        `;
    }

    calculateMetrics(){
        if(this.mode === "kmeans"){
            let clusters = this.getPointClusters(this.currentResult);
            let silhouette = this.calculateSilhouette(clusters);
            let inertia = this.calculateInertia(this.currentResult);
            let avgRadius = Math.sqrt(inertia / Math.max(1,this.data.length));

            return [
                this.metric("Silhouette",this.formatNumber(silhouette),this.qualityHigh(silhouette,0.65,0.35)),
                this.metric("Inertia sqrt/n",this.formatNumber(avgRadius),this.qualityLow(avgRadius,0.08,0.16,true))
            ];
        }

        if(this.mode === "spectral"){
            let clusters = this.getPointClusters(this.currentResult);
            let silhouette = this.calculateSilhouette(clusters);
            let purity = this.calculateNeighborhoodPurity(clusters);

            return [
                this.metric("Silhouette",this.formatNumber(silhouette),this.qualityHigh(silhouette,0.65,0.35)),
                this.metric("Neighborhood purity",this.formatNumber(purity),this.qualityHigh(purity,0.80,0.55))
            ];
        }

        if(this.mode === "fuzzy"){
            let fpc = this.calculateFPC(this.currentResult.memberships);
            let entropy = this.calculateEntropy(this.currentResult.memberships);

            return [
                this.metric("FPC",this.formatNumber(fpc),this.qualityHigh(fpc,0.75,0.55)),
                this.metric("Entropy",this.formatNumber(entropy),this.qualityLow(entropy,0.35,0.65))
            ];
        }

        if(this.mode === "gmm"){
            let gmm = this.calculateGMMInfo(this.currentResult);

            return [
                this.metric("Likelihood",this.formatNumber(gmm.logLikelihood,1),"plain","up","Higher likelihood is better"),
                this.metric("AIC",this.formatNumber(gmm.aic,0),"plain","down","Lower AIC is better"),
                this.metric("BIC",this.formatNumber(gmm.bic,0),"plain","down","Lower BIC is better")
            ];
        }

        if(this.mode === "dbscan"){
            let noisePercent = this.calculateNoisePercent(this.currentResult);
            let purity = this.calculateNeighborhoodPurity(this.getPointClusters(this.currentResult));

            return [
                this.metric("Noise %",`${this.formatNumber(noisePercent,1)}%`,this.qualityLow(noisePercent,10,30)),
                this.metric("Neighborhood purity",this.formatNumber(purity),this.qualityHigh(purity,0.80,0.55))
            ];
        }

        if(this.mode === "hdbscan"){
            let noisePercent = this.calculateNoisePercent(this.currentResult);
            let stability = this.currentResult.stability || 0;
            let normalizedStability = stability / Math.max(1,this.data.length);

            return [
                this.metric("Stability",this.formatNumber(stability),this.qualityHigh(normalizedStability,0.03,0.01)),
                this.metric("Noise %",`${this.formatNumber(noisePercent,1)}%`,this.qualityLow(noisePercent,10,30))
            ];
        }

        if(this.mode === "meanshift"){
            let weakRatio = (this.currentResult.weakCount || 0) / Math.max(1,this.data.length);
            let modeCount = this.currentResult.modes ? this.currentResult.modes.length : 0;
            let modeLimit = Math.max(2,Math.sqrt(Math.max(1,this.data.length)));
            let quality = "good";

            if(weakRatio > 0.20 || modeCount > modeLimit * 2){
                quality = "bad";
            }else if(weakRatio > 0.05 || modeCount > modeLimit){
                quality = "medium";
            }

            return [
                this.metric("Mode count",String(modeCount),quality)
            ];
        }

        let hClusters = this.getHClusterCut();
        let cophenetic = this.calculateCopheneticCorrelation(this.currentResult);
        let silhouette = this.calculateSilhouette(hClusters);

        return [
            this.metric("Cophenetic",this.formatNumber(cophenetic),this.qualityHigh(cophenetic,0.75,0.50)),
            this.metric("Silhouette",this.formatNumber(silhouette),this.qualityHigh(silhouette,0.65,0.35))
        ];
    }

    metric(name,value,quality,trend,title){
        let titles = {
            good:"Very good",
            medium:"Medium",
            bad:"Weak",
            neutral:"Neutral",
            plain:"Directional indicator"
        };

        return {
            name:name,
            value:value,
            quality:quality,
            trend:trend || "",
            title:title || titles[quality] || titles.neutral
        };
    }

    formatNumber(value,digits = 2){
        if(!Number.isFinite(value)){
            return "n/d";
        }

        return value.toFixed(digits);
    }

    qualityHigh(value,goodLimit,mediumLimit){
        if(!Number.isFinite(value)){
            return "neutral";
        }

        if(value >= goodLimit){
            return "good";
        }

        if(value >= mediumLimit){
            return "medium";
        }

        return "bad";
    }

    qualityLow(value,goodLimit,mediumLimit,isCanvasRatio = false){
        if(!Number.isFinite(value)){
            return "neutral";
        }

        if(isCanvasRatio){
            let size = Math.min(this.canvasHandler.width,this.canvasHandler.height);
            goodLimit *= size;
            mediumLimit *= size;
        }

        if(value <= goodLimit){
            return "good";
        }

        if(value <= mediumLimit){
            return "medium";
        }

        return "bad";
    }

    getPointClusters(result){
        if(!result || !result.clusters){
            return [];
        }

        return result.clusters
            .map((cluster) => cluster.points ? cluster.points : cluster)
            .filter((cluster) => cluster && cluster.length > 0);
    }

    calculateSilhouette(clusters){
        let items = [];

        for(let [clusterIndex,cluster] of clusters.entries()){
            for(let point of cluster){
                items.push({point:point,clusterIndex:clusterIndex});
            }
        }

        if(items.length < 2 || clusters.filter((cluster) => cluster.length > 0).length < 2){
            return 0;
        }

        let total = 0;

        for(let item of items){
            let ownCluster = clusters[item.clusterIndex];
            let a = this.averageDistanceToCluster(item.point,ownCluster,item.point);
            let b = Infinity;

            for(let [clusterIndex,cluster] of clusters.entries()){
                if(clusterIndex === item.clusterIndex || cluster.length === 0){
                    continue;
                }

                b = Math.min(b,this.averageDistanceToCluster(item.point,cluster,null));
            }

            if(!Number.isFinite(b)){
                b = 0;
            }

            if(a === 0 && b === 0){
                total += 0;
            }else{
                total += (b - a) / Math.max(a,b);
            }
        }

        return total / items.length;
    }

    averageDistanceToCluster(point,cluster,skipPoint){
        let total = 0;
        let count = 0;

        for(let other of cluster){
            if(other === skipPoint){
                continue;
            }

            total += euclidianDistance(point,other);
            count++;
        }

        return count === 0 ? 0 : total / count;
    }

    calculateInertia(result){
        let inertia = 0;

        for(let [i,cluster] of result.clusters.entries()){
            let points = cluster.points ? cluster.points : cluster;
            let centroid = result.centroids && result.centroids[i] ? result.centroids[i] : cluster.centroid;

            if(!centroid){
                continue;
            }

            for(let point of points){
                let distance = euclidianDistance(point,centroid);
                inertia += distance * distance;
            }
        }

        return inertia;
    }

    calculateNeighborhoodPurity(clusters){
        let items = [];

        for(let [clusterIndex,cluster] of clusters.entries()){
            for(let point of cluster){
                items.push({point:point,clusterIndex:clusterIndex});
            }
        }

        if(items.length < 2){
            return 0;
        }

        let k = Math.max(1,Math.min(items.length - 1,Math.round(Math.sqrt(items.length))));
        let purity = 0;

        for(let item of items){
            let neighbours = items
                .filter((other) => other !== item)
                .map((other) => ({
                    clusterIndex:other.clusterIndex,
                    distance:euclidianDistance(item.point,other.point)
                }))
                .sort((a,b) => a.distance - b.distance)
                .slice(0,k);

            let sameCluster = neighbours.filter((other) => other.clusterIndex === item.clusterIndex).length;
            purity += sameCluster / k;
        }

        return purity / items.length;
    }

    calculateFPC(memberships){
        if(!memberships || memberships.length === 0){
            return 0;
        }

        let total = 0;

        for(let row of memberships){
            for(let value of row){
                total += value * value;
            }
        }

        return total / memberships.length;
    }

    calculateEntropy(memberships){
        if(!memberships || memberships.length === 0 || memberships[0].length <= 1){
            return 0;
        }

        let total = 0;
        let norm = Math.log(memberships[0].length);

        for(let row of memberships){
            let rowEntropy = 0;

            for(let value of row){
                if(value > 0){
                    rowEntropy -= value * Math.log(value);
                }
            }

            total += rowEntropy / norm;
        }

        return total / memberships.length;
    }

    calculateGMMInfo(result){
        let k = result.components ? result.components.length : 1;
        let n = Math.max(1,this.data.length);
        let params = Math.max(1,k * 6 - 1);
        let logLikelihood = result.logLikelihood || 0;
        let aic = 2 * params - 2 * logLikelihood;
        let bic = Math.log(n) * params - 2 * logLikelihood;
        let bicPerPoint = bic / n;

        return {
            aic:aic,
            bic:bic,
            logLikelihood:logLikelihood,
            avgLogLikelihood:logLikelihood / n,
            quality:this.qualityLow(bicPerPoint,18,28)
        };
    }

    calculateNoisePercent(result){
        let noise = result && result.noise ? result.noise.length : 0;
        return noise / Math.max(1,this.data.length) * 100;
    }

    getHClusterCut(){
        if(!this.currentSteps || this.currentSteps.length === 0){
            return this.currentResult.currentClusters ? this.currentResult.currentClusters.map((cluster) => cluster.points) : [];
        }

        let target = Math.max(2,Math.round(Math.sqrt(Math.max(1,this.data.length))));
        let best = this.currentSteps[0];
        let bestDistance = Infinity;

        for(let step of this.currentSteps){
            if(!step.currentClusters){
                continue;
            }

            let distance = Math.abs(step.currentClusters.length - target);

            if(distance < bestDistance){
                best = step;
                bestDistance = distance;
            }
        }

        return best.currentClusters.map((cluster) => cluster.points);
    }

    calculateCopheneticCorrelation(result){
        if(!result || !result.allClusters || this.data.length < 3){
            return 0;
        }

        let pairValues = [];
        let cophenetic = {};
        let allClusters = result.allClusters
            .filter((cluster) => cluster.tree && cluster.tree.length > 0)
            .sort((a,b) => a.level - b.level);

        for(let cluster of allClusters){
            for(let i = 0;i < cluster.points.length;i++){
                for(let j = i + 1;j < cluster.points.length;j++){
                    let first = cluster.points[i].i;
                    let second = cluster.points[j].i;
                    let key = first < second ? `${first}-${second}` : `${second}-${first}`;

                    if(cophenetic[key] === undefined){
                        cophenetic[key] = cluster.mergeDistance;
                    }
                }
            }
        }

        for(let i = 0;i < this.data.length;i++){
            for(let j = i + 1;j < this.data.length;j++){
                let key = `${i}-${j}`;

                if(cophenetic[key] === undefined){
                    continue;
                }

                pairValues.push({
                    original:euclidianDistance(this.data[i],this.data[j]),
                    cophenetic:cophenetic[key]
                });
            }
        }

        return this.calculateCorrelation(
            pairValues.map((pair) => pair.original),
            pairValues.map((pair) => pair.cophenetic)
        );
    }

    calculateCorrelation(firstValues,secondValues){
        if(firstValues.length < 2 || firstValues.length !== secondValues.length){
            return 0;
        }

        let firstMean = firstValues.reduce((sum,value) => sum + value,0) / firstValues.length;
        let secondMean = secondValues.reduce((sum,value) => sum + value,0) / secondValues.length;
        let numerator = 0;
        let firstDenominator = 0;
        let secondDenominator = 0;

        for(let i = 0;i < firstValues.length;i++){
            let firstDiff = firstValues[i] - firstMean;
            let secondDiff = secondValues[i] - secondMean;

            numerator += firstDiff * secondDiff;
            firstDenominator += firstDiff * firstDiff;
            secondDenominator += secondDiff * secondDiff;
        }

        let denominator = Math.sqrt(firstDenominator * secondDenominator);

        if(denominator === 0){
            return 0;
        }

        return numerator / denominator;
    }

    runKMeans(isStep){
        if(!this.checkData()){
            return;
        }

        if(this.kmeans.init_centroid.length === 0){
            this.setStatus("Generate centroids first");
            return;
        }

        if(isStep && this.currentSteps.length > 0){
            this.showNextStep();
            return;
        }

        let result = this.kmeans.run(this.data);
        this.currentSteps = result.steps;

        if(isStep){
            this.stepIndex = 0;
            this.showNextStep();
        }else{
            this.currentResult = result;
            this.metricsReady = true;
            this.setStatus(`K-Means completed in ${result.iterations} iterations`);
            this.render();
        }
    }

    runDBSCAN(isStep){
        if(!this.checkData()){
            return;
        }

        let eps = this.readPositiveFloat("dbscanEpsilon","Invalid epsilon");
        let minPts = this.readPositiveInt("dbscanMinPts","Invalid MinPTS");

        if(!eps || !minPts){
            return;
        }

        if(isStep && this.currentSteps.length > 0){
            this.showNextStep();
            return;
        }

        let result = this.dbscan.run(this.data,eps,minPts);
        this.currentSteps = result.steps;

        if(isStep){
            this.stepIndex = 0;
            this.showNextStep();
        }else{
            this.currentResult = result;
            this.metricsReady = true;
            this.setStatus(`DBSCAN: ${result.clusters.length} clusters`);
            this.render();
        }
    }

    runSpectral(isStep){
        if(!this.checkData()){
            return;
        }

        let k = this.readPositiveInt("spectralK","Invalid Spectral K");
        let sigma = this.readPositiveFloat("spectralSigma","Invalid Spectral sigma");

        if(!k || !sigma){
            return;
        }

        if(k > this.data.length){
            this.setStatus("Spectral: K cannot exceed the number of points");
            return;
        }

        if(this.data.length > 180){
            this.setStatus("Spectral: keep points below 180 to avoid freezing the browser");
            return;
        }

        if(isStep && this.currentSteps.length > 0){
            this.showNextStep();
            return;
        }

        let result = this.spectral.run(this.data,k,sigma);
        this.currentSteps = result.steps;

        if(isStep){
            this.stepIndex = 0;
            this.showNextStep();
        }else{
            this.currentResult = result;
            this.metricsReady = true;
            this.setStatus(`Spectral: ${result.clusters.length} clusters`);
            this.render();
        }
    }

    runFuzzy(isStep){
        if(!this.checkData()){
            return;
        }

        let k = this.readPositiveInt("fuzzyClusters","Invalid Fuzzy clusters");
        let m = this.readPositiveFloat("fuzzyM","Invalid fuzziness");
        let iterations = this.readPositiveInt("fuzzyIterations","Invalid Fuzzy iterations");

        if(!k || !m || !iterations){
            return;
        }

        if(k > this.data.length){
            this.setStatus("Fuzzy: clusters cannot exceed the number of points");
            return;
        }

        if(m <= 1){
            this.setStatus("Fuzzy: fuzziness must be greater than 1");
            return;
        }

        if(isStep && this.currentSteps.length > 0){
            this.showNextStep();
            return;
        }

        let result = this.fuzzy.run(this.data,k,m,iterations);
        this.currentSteps = result.steps;

        if(isStep){
            this.stepIndex = 0;
            this.showNextStep();
        }else{
            this.currentResult = result;
            this.metricsReady = true;
            this.setStatus(`Fuzzy C-Means completed in ${result.iterations} iterations`);
            this.render();
        }
    }

    runMeanShift(isStep){
        if(!this.checkData()){
            return;
        }

        let bandwidth = this.readPositiveFloat("meanShiftBandwidth","Invalid bandwidth");
        let iterations = this.readPositiveInt("meanShiftIterations","Invalid Mean Shift iterations");

        if(!bandwidth || !iterations){
            return;
        }

        if(isStep && this.currentSteps.length > 0){
            this.showNextStep();
            return;
        }

        let result = this.meanShift.run(this.data,bandwidth,iterations);
        this.currentSteps = result.steps;

        if(isStep){
            this.stepIndex = 0;
            this.showNextStep();
        }else{
            this.currentResult = result;
            this.metricsReady = true;
            this.setStatus(`Mean Shift: ${result.modes.length} modes found`);
            this.render();
        }
    }

    runGMM(isStep){
        if(!this.checkData()){
            return;
        }

        let k = this.readPositiveInt("gmmComponents","Invalid GMM components");
        let iterations = this.readPositiveInt("gmmIterations","Invalid GMM iterations");

        if(!k || !iterations){
            return;
        }

        if(k > this.data.length){
            this.setStatus("GMM: components cannot exceed the number of points");
            return;
        }

        if(isStep && this.currentSteps.length > 0){
            this.showNextStep();
            return;
        }

        let result = this.gmm.run(this.data,k,iterations);
        this.currentSteps = result.steps;

        if(isStep){
            this.stepIndex = 0;
            this.showNextStep();
        }else{
            this.currentResult = result;
            this.metricsReady = true;
            this.setStatus(`GMM completed in ${result.iterations} iterations`);
            this.render();
        }
    }

    runHDBSCAN(isStep){
        if(!this.checkData()){
            return;
        }

        let minPts = this.readPositiveInt("hdbscanMinPts","Invalid HDBSCAN MinPTS");
        let minClusterSize = this.readPositiveInt("hdbscanMinClusterSize","Invalid min cluster size");

        if(!minPts || !minClusterSize){
            return;
        }

        if(this.data.length > 260){
            this.setStatus("HDBSCAN: keep points below 260 to avoid freezing the browser");
            return;
        }

        if(isStep && this.currentSteps.length > 0){
            this.showNextStep();
            return;
        }

        let result = this.hdbscan.run(this.data,minPts,minClusterSize);
        this.currentSteps = result.steps;

        if(isStep){
            this.stepIndex = 0;
            this.showNextStep();
        }else{
            this.currentResult = result;
            this.metricsReady = true;
            this.setStatus(`HDBSCAN: ${result.clusters.length} clusters, ${result.noise.length} noise`);
            this.render();
        }
    }

    runHCluster(isStep){
        if(!this.checkData()){
            return;
        }

        if(this.data.length > 220){
            this.setStatus("HCluster: keep points below 220 to avoid freezing the browser");
            return;
        }

        if(isStep && this.currentSteps.length > 0){
            this.showNextStep();
            return;
        }

        let linkage = DOMgetValue("hclusterCriterion");
        let metric = DOMgetValue("hclusterMetric");
        let result = this.hcluster.run(this.data,linkage,metric);

        this.currentSteps = result.steps;

        if(isStep){
            this.stepIndex = 0;
            this.showNextStep();
        }else{
            this.currentResult = result;
            this.metricsReady = true;
            this.setStatus(`HCluster completed in ${result.iterations} iterations`);
            this.render();
        }
    }

    showNextStep(){
        if(this.stepIndex >= this.currentSteps.length){
            this.setStatus("Steps completed");
            return;
        }

        this.currentResult = this.currentSteps[this.stepIndex];
        this.stepIndex++;
        this.metricsReady = this.stepIndex >= this.currentSteps.length;
        let label = this.currentResult.phaseLabel ? `: ${this.currentResult.phaseLabel}` : "";
        this.setStatus(`Step ${this.stepIndex}/${this.currentSteps.length}${label}`);
        this.render();
    }

    render(){
        DOMsetValue("pointCounter",`Points: ${this.data.length}`);
        this.updateLegend();

        if(this.mode === "kmeans"){
            this.canvasHandler.drawKMeans(
                this.data,
                this.kmeans.init_centroid,
                this.currentResult,
                DOM("showBoundaries").checked
            );
            return;
        }

        if(this.mode === "dbscan"){
            this.canvasHandler.drawDBSCAN(
                this.data,
                this.currentResult,
                DOM("dbscanDrawEps").checked,
                DOM("showBoundaries").checked
            );
            return;
        }

        if(this.mode === "spectral"){
            this.canvasHandler.drawSpectral(
                this.data,
                this.currentResult,
                DOM("showBoundaries").checked
            );
            return;
        }

        if(this.mode === "fuzzy"){
            this.canvasHandler.drawFuzzy(
                this.data,
                this.currentResult,
                DOM("showBoundaries").checked
            );
            return;
        }

        if(this.mode === "meanshift"){
            this.canvasHandler.drawMeanShift(
                this.data,
                this.currentResult,
                DOM("meanShiftDensityMap").checked,
                DOM("showTrails").checked,
                DOM("showDetails").checked
            );
            return;
        }

        if(this.mode === "gmm"){
            this.canvasHandler.drawGMM(
                this.data,
                this.currentResult,
                DOM("showBoundaries").checked
            );
            return;
        }

        if(this.mode === "hdbscan"){
            this.canvasHandler.drawHDBSCAN(
                this.data,
                this.currentResult,
                DOM("showBoundaries").checked
            );
            return;
        }

        if(!this.currentResult){
            this.canvasHandler.reset();
            this.canvasHandler.drawPoints(this.data,"#000000");
            return;
        }

        this.canvasHandler.drawHCluster(this.currentResult);
    }

    clearResult(){
        this.currentResult = null;
        this.currentSteps = [];
        this.stepIndex = 0;
        this.metricsReady = false;
        this.updateMetrics();
    }

    checkData(){
        if(this.data.length === 0){
            this.setStatus("Add some points first");
            return false;
        }

        return true;
    }

    readPositiveInt(id,errorMessage){
        let value = parseInt(DOMgetValue(id));

        if(!Number.isInteger(value) || value <= 0){
            this.setStatus(errorMessage);
            return null;
        }

        return value;
    }

    readPositiveFloat(id,errorMessage){
        let value = parseFloat(DOMgetValue(id));

        if(!Number.isFinite(value) || value <= 0){
            this.setStatus(errorMessage);
            return null;
        }

        return value;
    }

    setStatus(message){
        DOMsetValue("statusText",message);
        this.updateMetrics();
    }
}

document.addEventListener("DOMContentLoaded",() => {
    new AppController();
});
