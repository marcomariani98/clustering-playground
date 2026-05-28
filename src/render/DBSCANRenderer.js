"use strict";

class DBSCANRenderer{
    constructor(primitives){
        this.p = primitives;
    }

    draw(data, options){
        let p = this.p;
        let { result, showEpsilon, showBoundaries, showDetails } = options;

        p.reset();

        if(!result){
            p.drawPoints(data, p.glyphColor());
            return;
        }

        if(showBoundaries){
            this._drawBoundaries(result);
        }

        this._drawBasePoints(data, result);

        if(showEpsilon){
            this._drawRanges(data, result);
        }

        for(let [i, cluster] of result.clusters.entries()){
            p.drawPoints(cluster, cluster_color[i % cluster_color.length]);
        }

        p.drawCentroids(result.noise, p.glyphColor());
        p.drawPoints(result.border, "#A020F0");
        this._drawCurrentQuery(result);
        this._drawPointRoles(result, showDetails);
        p.drawInfo(result.phaseLabel || `DBSCAN - clusters: ${result.clusters.length} - noise: ${result.noise.length}`);
    }

    // Punti grigi sullo sfondo: piu' chiari se gia' visitati, piu' scuri se no.
    _drawBasePoints(data, result){
        let p = this.p;
        let visited = new Set(result.visitedIndexes || []);

        let baseColor = p.glyphColor();
        for(let [i, point] of data.entries()){
            p.drawPointAlpha(point, baseColor, visited.has(i) ? 0.22 : 0.46);
        }
    }

    // Cerchi epsilon su tutti i punti, opacita' modulata dalla densita' locale.
    // Salta esplicitamente il currentPoint: la _drawCurrentQuery disegna gia'
    // il proprio cerchio blu, evitando il doppio tratto sovrapposto.
    _drawRanges(data, result){
        let p = this.p;
        let maxCount = Math.max(1, ...result.neighborCounts);
        let currentIndex = result.currentPoint ? result.currentPoint.i : -1;
        let eps = Math.max(1, result.eps || 0);

        for(let [i, point] of data.entries()){
            if(i === currentIndex) continue;
            let density = (result.neighborCounts[i] || 1) / maxCount;
            let alpha = 0.14 + density * 0.26;
            let lineWidth = 1 + density * 1.6;
            p.drawRadius(point.x, point.y, eps, `rgba(73, 82, 96, ${alpha})`, lineWidth);
        }
    }

    // Lo step corrente: cerchio blu sul punto in visita + linee verso i vicini.
    // Il label mostra il valore numerico di eps cosi' resta sincronizzato con
    // il parametro nella sidebar anche se l'utente lo modifica fra una run e l'altra.
    _drawCurrentQuery(result){
        if(!result || !result.currentPoint) return;

        let p = this.p;
        let current = result.currentPoint;
        let neighbors = result.currentNeighbors || [];
        let eps = Math.max(1, result.eps || 0);

        p.ctx.save();
        p.drawRadius(current.x, current.y, eps, "rgba(23, 105, 224, 0.55)", 2.4);

        for(let neighbor of neighbors){
            p.ctx.beginPath();
            p.ctx.moveTo(current.x, current.y);
            p.ctx.lineTo(neighbor.x, neighbor.y);
            p.ctx.strokeStyle = "rgba(23, 105, 224, 0.22)";
            p.ctx.lineWidth = 1;
            p.ctx.stroke();

            p.ctx.beginPath();
            p.ctx.arc(neighbor.x, neighbor.y, 6, 0, 2 * Math.PI, false);
            p.ctx.strokeStyle = "rgba(23, 105, 224, 0.36)";
            p.ctx.lineWidth = 1.2;
            p.ctx.stroke();
        }

        p.ctx.beginPath();
        p.ctx.arc(current.x, current.y, 7, 0, 2 * Math.PI, false);
        p.ctx.fillStyle = "rgba(23, 105, 224, 0.90)";
        p.ctx.fill();
        p.ctx.strokeStyle = "#ffffff";
        p.ctx.lineWidth = 2;
        p.ctx.stroke();

        let epsLabel = `eps=${eps.toFixed(eps < 10 ? 1 : 0)}`;
        p.drawLabel({ x: current.x + 10, y: current.y - 10 }, epsLabel, "#1769e0", "700 12px Arial");
        p.ctx.restore();
    }

    _drawPointRoles(result, showDetails){
        if(!showDetails) return;

        let p = this.p;
        let totalMarked = result.border ? result.border.length : 0;
        // Sopra 120 i marker B diventano illeggibili, mostriamo solo il dot.
        let drawLetters = totalMarked <= 120;

        p.ctx.save();
        p.ctx.font = "700 10px Arial";
        p.ctx.textAlign = "center";
        p.ctx.textBaseline = "middle";

        for(let point of result.border || []){
            p.ctx.fillStyle = "#ffffff";
            p.ctx.beginPath();
            p.ctx.arc(point.x, point.y, 3.2, 0, 2 * Math.PI, false);
            p.ctx.fill();
            p.ctx.fillStyle = "#7e22ce";

            if(drawLetters){
                p.ctx.fillText("B", point.x, point.y + 0.2);
            }
        }

        p.ctx.restore();
    }

    // Frontiere: cella colorata se il core piu' vicino e' dentro epsilon. Cosi'
    // le regioni "sfocate" oltre eps non vengono dipinte (giusto comportamento).
    _drawBoundaries(result){
        let p = this.p;
        let cellSize = 8;

        for(let y = 0; y < p.height; y += cellSize){
            for(let x = 0; x < p.width; x += cellSize){
                let probe = { x: x + cellSize / 2, y: y + cellSize / 2 };
                let pick = -1;
                let minDistance = Infinity;

                for(let [i, cluster] of result.clusters.entries()){
                    let cores = cluster.filter((item) => item.label === "core");
                    let points = cores.length > 0 ? cores : cluster;

                    for(let cp of points){
                        let d = euclidianDistance(probe, cp);
                        if(d <= result.eps && d < minDistance){
                            minDistance = d;
                            pick = i;
                        }
                    }
                }

                if(pick >= 0){
                    p.ctx.fillStyle = p.colorAlpha(cluster_color[pick % cluster_color.length], 0.13);
                    p.ctx.fillRect(x, y, cellSize, cellSize);
                }
            }
        }
    }
}
