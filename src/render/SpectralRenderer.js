"use strict";

class SpectralRenderer{
    constructor(primitives){
        this.p = primitives;
    }

    draw(data, options){
        let p = this.p;
        let { result, showBoundaries, showDetails } = options;

        p.reset();

        if(!result){
            p.drawPoints(data, p.glyphColor());
            return;
        }

        let view = result.view || "clusters";
        // Sopra 120 punti il grafo affinity diventa un'unica macchia: lo nascondiamo.
        let canDrawAffinity = result.affinity && data.length <= 120;

        if(view === "affinity"){
            if(canDrawAffinity){
                this._drawAffinityGraph(data, result.affinity, 1);
            }
            p.drawPoints(data, p.glyphColor());
            p.drawInfo(`Spectral - ${result.phaseLabel || "affinity graph"}`);
            return;
        }

        if(view === "laplacian"){
            if(canDrawAffinity){
                this._drawAffinityGraph(data, result.affinity, 0.45);
            }
            this._drawDegreeHalos(data, result.degree);
            p.drawPoints(data, p.glyphColor());
            p.drawInfo(`Spectral - ${result.phaseLabel || "normalized Laplacian"}`);
            return;
        }

        if(view === "embedding"){
            p.drawPoints(data, p.glyphColor());
            this._drawEmbedding(result, true);
            p.drawInfo(`Spectral - ${result.phaseLabel || "spectral embedding"}`);
            return;
        }

        if(showDetails && canDrawAffinity){
            this._drawAffinityGraph(data, result.affinity, 0.35);
        }

        if(showBoundaries){
            p.drawNearestPointBoundaries(result.clusters);
        }

        this._drawClusters(result);

        if(showDetails && result.embedding){
            this._drawEmbedding(result, false);
        }

        p.drawInfo(`Spectral - ${result.phaseLabel || "final clusters"}`);
    }

    _drawClusters(result){
        let p = this.p;
        for(let [i, cluster] of result.clusters.entries()){
            let color = cluster_color[i % cluster_color.length];
            p.drawPoints(cluster, color);

            if(cluster.length > 0){
                let centroid = p.centroidOf(cluster);
                p.drawLabel(centroid, `S${i + 1}`, p.glyphColor(), "700 12px Arial");
            }
        }
    }

    // Per ogni punto disegna le 4 affinity piu' forti, evitando doppi conteggi.
    _drawAffinityGraph(data, affinity, intensity = 1){
        if(!data || !affinity || data.length === 0) return;

        let p = this.p;
        p.ctx.save();

        for(let i = 0; i < data.length; i++){
            let edges = [];
            for(let j = 0; j < data.length; j++){
                if(i === j) continue;
                edges.push({ index: j, weight: affinity[i][j] || 0 });
            }
            edges.sort((a, b) => b.weight - a.weight);

            for(let edge of edges.slice(0, 4)){
                if(edge.weight < 0.08 || i > edge.index) continue;

                let alpha = (0.05 + Math.min(0.30, edge.weight * 0.34)) * intensity;
                let lineWidth = 0.6 + edge.weight * 1.4;
                let target = data[edge.index];

                p.ctx.beginPath();
                p.ctx.moveTo(data[i].x, data[i].y);
                p.ctx.lineTo(target.x, target.y);
                p.ctx.strokeStyle = `rgba(23, 105, 224, ${alpha})`;
                p.ctx.lineWidth = lineWidth;
                p.ctx.stroke();
            }
        }

        p.ctx.restore();
    }

    // Aloni con raggio proporzionale al degree: nodi piu' "centrali" risaltano.
    _drawDegreeHalos(data, degree){
        if(!data || !degree || degree.length === 0) return;

        let p = this.p;
        let maxDegree = Math.max(0.0001, ...degree);

        p.ctx.save();
        for(let [i, point] of data.entries()){
            let ratio = (degree[i] || 0) / maxDegree;
            let radius = 8 + ratio * 18;

            p.ctx.beginPath();
            p.ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
            p.ctx.fillStyle = `rgba(23, 105, 224, ${0.05 + ratio * 0.13})`;
            p.ctx.fill();
            p.ctx.strokeStyle = `rgba(23, 105, 224, ${0.18 + ratio * 0.26})`;
            p.ctx.lineWidth = 1 + ratio * 1.4;
            p.ctx.stroke();
        }
        p.ctx.restore();
    }

    // Pannello in alto a destra con lo scatter degli autovettori. Quando lo
    // step e' "embedding" il pannello e' grande (isFocus), altrimenti compatto.
    _drawEmbedding(result, isFocus = false){
        if(!result.embedding || result.embedding.length === 0) return;

        let p = this.p;
        let panel = {
            width: isFocus ? Math.min(420, Math.max(300, p.width * 0.38)) : Math.min(260, Math.max(190, p.width * 0.24)),
            height: isFocus ? Math.min(330, Math.max(240, p.height * 0.38)) : Math.min(210, Math.max(160, p.height * 0.24))
        };
        panel.x = p.width - panel.width - 18;
        panel.y = 44;

        let points = result.embedding.map((row) => ({
            x: row[0] || 0,
            y: row.length > 1 ? row[1] : 0
        }));
        let minX = Math.min(...points.map((point) => point.x));
        let maxX = Math.max(...points.map((point) => point.x));
        let minY = Math.min(...points.map((point) => point.y));
        let maxY = Math.max(...points.map((point) => point.y));
        let pad = 20;
        let spanX = Math.max(0.0001, maxX - minX);
        let spanY = Math.max(0.0001, maxY - minY);
        let pointCluster = new Map();

        if(result.clusters){
            for(let [i, cluster] of result.clusters.entries()){
                for(let point of cluster){
                    if(point.i !== undefined){
                        pointCluster.set(point.i, i);
                    }
                }
            }
        }

        let isDark = p.isDarkTheme();
        p.ctx.save();
        p.ctx.fillStyle = p.panelBg(0.94);
        p.ctx.strokeStyle = isDark ? "rgba(148,163,184,0.45)" : "rgba(148,163,184,0.75)";
        p.ctx.lineWidth = 1;
        p.roundRect(panel.x, panel.y, panel.width, panel.height, 8);
        p.ctx.fill();
        p.ctx.stroke();

        p.ctx.fillStyle = p.glyphColor();
        p.ctx.font = "800 12px Arial";
        p.ctx.fillText("Spectral embedding", panel.x + 12, panel.y + 20);

        // Croce centrale come riferimento (origine dello spazio embedding).
        p.ctx.strokeStyle = isDark ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.35)";
        p.ctx.lineWidth = 1;
        p.ctx.beginPath();
        p.ctx.moveTo(panel.x + pad, panel.y + panel.height / 2);
        p.ctx.lineTo(panel.x + panel.width - pad, panel.y + panel.height / 2);
        p.ctx.moveTo(panel.x + panel.width / 2, panel.y + pad + 10);
        p.ctx.lineTo(panel.x + panel.width / 2, panel.y + panel.height - pad);
        p.ctx.stroke();

        for(let [i, point] of points.entries()){
            let x = panel.x + pad + ((point.x - minX) / spanX) * (panel.width - pad * 2);
            let y = panel.y + panel.height - pad - ((point.y - minY) / spanY) * (panel.height - pad * 2 - 12);
            let clusterIndex = pointCluster.has(i) ? pointCluster.get(i) : i % cluster_color.length;

            p.ctx.beginPath();
            p.ctx.arc(x, y, 3, 0, 2 * Math.PI, false);
            p.ctx.fillStyle = cluster_color[clusterIndex % cluster_color.length];
            p.ctx.fill();
        }

        p.ctx.restore();
    }
}
