"use strict";

// Mean Shift visualization. Renders points colored by their converged mode, crosses marking
// density maxima (modes), circles showing the kernel bandwidth, trails showing point trajectories,
// contour lines for density levels, and colored bands for KDE intensity regions.

class MeanShiftRenderer{
    constructor(primitives){
        this.p = primitives;
    }

    draw(data, options){
        let p = this.p;
        let { result, showDensity, showTrails, showDetails } = options;

        p.reset();

        if(!result){
            p.drawPoints(data, p.glyphColor());
            return;
        }

        if(showDensity){
            this._drawDensityMap(data, result);
        }

        if(showTrails && result.trails){
            this._drawTrails(result.trails, result.assignment, result.clusters);
        }

        for(let [i, cluster] of result.clusters.entries()){
            let color = cluster_color[i % cluster_color.length];
            // Cluster da uno o due punti: micro-cluster da non promuovere visivamente.
            let isWeak = cluster.length <= 2;

            p.drawPoints(cluster, isWeak ? "#9ca3af" : color);

            if(showDetails && result.modes[i] && !isWeak){
                p.drawRadius(result.modes[i].x, result.modes[i].y, result.bandwidth, p.colorAlpha(color, 0.28), 1.2);
                p.drawCentroids([result.modes[i]], color);
                p.drawLabel(result.modes[i], `M${i + 1}`, p.glyphColor(), "700 12px Arial");
            }
        }

        p.drawInfo(`Mean Shift - modes: ${result.modes.length} - weak/noise: ${result.weakCount} - iterations: ${result.iterations}`);
    }

    // KDE su una griglia + bande di colore + curve di livello. La griglia
    // a 14px e' un compromesso tra velocita' e leggibilita': sotto 10 il
    // ricalcolo si vede a Play veloce, sopra 20 le curve diventano spigolose.
    _drawDensityMap(data, result){
        if(!data || data.length === 0 || !result || !result.bandwidth) return;

        let p = this.p;
        let cellSize = 14;
        let cols = Math.ceil(p.width / cellSize) + 1;
        let rows = Math.ceil(p.height / cellSize) + 1;
        let bandwidth = Math.max(1, result.bandwidth);
        let sigma2 = 2 * bandwidth * bandwidth;
        let values = [];
        let maxDensity = 0;

        for(let row = 0; row < rows; row++){
            values[row] = [];
            for(let col = 0; col < cols; col++){
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
                if(density > maxDensity) maxDensity = density;
            }
        }

        if(maxDensity <= 0) return;

        this._drawDensityBands(values, maxDensity, cellSize);
        this._drawContourLines(values, maxDensity, cellSize);
    }

    _drawDensityBands(values, maxDensity, cellSize){
        let p = this.p;
        // Su dark gli alpha vanno raddoppiati: lo sfondo scuro "ingoia" i toni
        // tenui che in light invece bastavano. Anche i blu/teal vengono spostati
        // un filo verso il ciano per non sparire sul navy.
        let bands = p.isDarkTheme() ? [
            { limit: 0.18, color: "rgba(96, 165, 250, 0.10)" },
            { limit: 0.32, color: "rgba(45, 212, 191, 0.13)" },
            { limit: 0.50, color: "rgba(74, 222, 128, 0.16)" },
            { limit: 0.68, color: "rgba(250, 204, 21, 0.18)" },
            { limit: 0.84, color: "rgba(251, 146, 60, 0.20)" },
            { limit: 1.01, color: "rgba(248, 113, 113, 0.24)" }
        ] : [
            { limit: 0.18, color: "rgba(59, 130, 246, 0.045)" },
            { limit: 0.32, color: "rgba(20, 184, 166, 0.060)" },
            { limit: 0.50, color: "rgba(34, 197, 94, 0.075)" },
            { limit: 0.68, color: "rgba(234, 179, 8, 0.090)" },
            { limit: 0.84, color: "rgba(249, 115, 22, 0.105)" },
            { limit: 1.01, color: "rgba(220, 38, 38, 0.120)" }
        ];

        for(let row = 0; row < values.length - 1; row++){
            for(let col = 0; col < values[row].length - 1; col++){
                let normalized = values[row][col] / maxDensity;
                let band = bands.find((item) => normalized <= item.limit);
                p.ctx.fillStyle = band.color;
                p.ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
            }
        }
    }

    _drawContourLines(values, maxDensity, cellSize){
        let p = this.p;
        let levels = [0.18, 0.32, 0.46, 0.60, 0.74, 0.88];
        // Su dark le linee nere spariscono: usiamo un grigio chiaro con stessi alpha.
        let strokeBase = p.isDarkTheme() ? "226, 232, 240" : "15, 23, 42";

        p.ctx.save();
        p.ctx.lineWidth = 1.1;
        p.ctx.lineCap = "round";
        p.ctx.lineJoin = "round";

        for(let [levelIndex, levelRatio] of levels.entries()){
            let threshold = maxDensity * levelRatio;
            p.ctx.beginPath();

            for(let row = 0; row < values.length - 1; row++){
                for(let col = 0; col < values[row].length - 1; col++){
                    this._contourCell(values, row, col, threshold, cellSize);
                }
            }

            let alpha = 0.18 + levelIndex * 0.055;
            p.ctx.strokeStyle = `rgba(${strokeBase}, ${alpha})`;
            p.ctx.stroke();
        }

        p.ctx.restore();
    }

    // Marching squares semplificato: per ogni cella, trova i due segmenti
    // di intersezione con il threshold e li disegna. Non gestisce i casi
    // ambigui (saddle) ma per una KDE liscia non si vedono artifact.
    _contourCell(values, row, col, threshold, cellSize){
        let p = this.p;
        let x = col * cellSize;
        let y = row * cellSize;
        let tl = values[row][col];
        let tr = values[row][col + 1];
        let br = values[row + 1][col + 1];
        let bl = values[row + 1][col];
        let points = [];

        let addIntersection = (first, second, fp, sp) => {
            if((first < threshold && second < threshold) || (first >= threshold && second >= threshold)){
                return;
            }
            let ratio = (threshold - first) / (second - first);
            points.push({
                x: fp.x + (sp.x - fp.x) * ratio,
                y: fp.y + (sp.y - fp.y) * ratio
            });
        };

        addIntersection(tl, tr, { x: x, y: y }, { x: x + cellSize, y: y });
        addIntersection(tr, br, { x: x + cellSize, y: y }, { x: x + cellSize, y: y + cellSize });
        addIntersection(br, bl, { x: x + cellSize, y: y + cellSize }, { x: x, y: y + cellSize });
        addIntersection(bl, tl, { x: x, y: y + cellSize }, { x: x, y: y });

        if(points.length < 2) return;

        for(let i = 0; i < points.length - 1; i += 2){
            p.ctx.moveTo(points[i].x, points[i].y);
            p.ctx.lineTo(points[i + 1].x, points[i + 1].y);
        }
    }

    // Le tracce mostrano dove ogni punto e' migrato. Se finisce in un cluster
    // debole la tinto grigia per non promuovere visivamente un mode debole.
    _drawTrails(trails, assignment, clusters){
        let p = this.p;
        for(let i = 0; i < trails.length; i++){
            let path = trails[i];
            if(!path || path.length < 2) continue;

            let clusterIndex = assignment ? assignment[i] : 0;
            let cluster = clusters && clusterIndex >= 0 ? clusters[clusterIndex] : [];
            let color = clusterIndex >= 0 && cluster.length > 2
                ? cluster_color[clusterIndex % cluster_color.length]
                : "#9ca3af";

            p.ctx.beginPath();
            p.ctx.moveTo(path[0].x, path[0].y);
            for(let j = 1; j < path.length; j++){
                p.ctx.lineTo(path[j].x, path[j].y);
            }
            p.ctx.strokeStyle = p.colorAlpha(color, 0.24);
            p.ctx.lineWidth = 1.4;
            p.ctx.stroke();

            let last = path[path.length - 1];
            p.ctx.beginPath();
            p.ctx.arc(last.x, last.y, 2.5, 0, 2 * Math.PI, false);
            p.ctx.fillStyle = p.colorAlpha(color, 0.55);
            p.ctx.fill();
        }
    }
}
