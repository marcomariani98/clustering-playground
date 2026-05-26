"use strict";

class HClusterRenderer{
    constructor(primitives){
        this.p = primitives;
    }

    draw(data, options){
        let p = this.p;
        let { result } = options;

        p.reset();

        if(!result){
            p.drawPoints(data, p.glyphColor());
            return;
        }

        let activeClusters = result.currentClusters || result.allClusters;

        this._drawLinks(result);

        for(let [i, cluster] of activeClusters.entries()){
            this._drawBubble(cluster, cluster_color[i % cluster_color.length]);
        }

        this._drawLabels(result, activeClusters);

        // Quando tutto e' collassato in un unico cluster e c'erano partenze
        // multiple, mostriamo il dendrogramma pieno in un pannello a parte.
        if(result.currentClusters && result.currentClusters.length === 1 && result.initClusters > 1){
            this._drawTree(result);
        }

        this._drawInfo(result);
    }

    _drawLinks(result){
        let p = this.p;
        let clusterMap = new Map(result.allClusters.map((cluster) => [cluster.id, cluster]));

        for(let cluster of result.allClusters){
            if(!cluster.tree || cluster.tree.length !== 2) continue;

            for(let childId of cluster.tree){
                let child = clusterMap.get(childId);
                if(!child) continue;

                p.ctx.beginPath();
                p.ctx.moveTo(child.centroid.x, child.centroid.y);
                p.ctx.lineTo(cluster.centroid.x, cluster.centroid.y);
                // Spessore proporzionale alla dimensione: i merge "grossi" risaltano.
                p.ctx.lineWidth = Math.min(3, 0.8 + cluster.points.length / 40);
                p.ctx.strokeStyle = "rgba(74, 85, 104, 0.34)";
                p.ctx.stroke();
            }
        }
    }

    _drawLabels(result, activeClusters){
        let p = this.p;
        let activeIds = new Set(activeClusters.map((cluster) => cluster.id));

        for(let cluster of result.allClusters){
            let isActive = activeIds.has(cluster.id);
            let label = cluster.points.length === 1 ? `P${cluster.points[0].i + 1}` : `C${cluster.id}`;
            p.drawSoftLabel(cluster.centroid, label, isActive);
        }
    }

    _drawBubble(cluster, color){
        let p = this.p;
        let radius = cluster.points.length === 1 ? 18 : Math.max(22, getMaxDist(cluster.points, cluster.centroid));

        p.ctx.beginPath();
        p.ctx.arc(cluster.centroid.x, cluster.centroid.y, radius, 0, 2 * Math.PI, false);
        p.ctx.fillStyle = p.colorAlpha(color, 0.09);
        p.ctx.fill();
        p.ctx.lineWidth = Math.min(4, 1.2 + cluster.points.length / 18);
        p.ctx.strokeStyle = p.colorAlpha(color, 0.62);
        p.ctx.stroke();

        p.drawPoints(cluster.points, color);

        let ink = p.glyphColor();
        p.ctx.beginPath();
        p.ctx.arc(cluster.centroid.x, cluster.centroid.y, 5, 0, 2 * Math.PI, false);
        p.ctx.fillStyle = ink;
        p.ctx.fill();

        p.drawLabel(
            { x: cluster.centroid.x + 8, y: cluster.centroid.y - 8 },
            `C${cluster.id} (${cluster.points.length})`,
            ink,
            "700 12px Arial"
        );
    }

    _drawInfo(result){
        let p = this.p;
        let text = `${result.linkage} / ${result.metric} - merge: ${result.iterations}`;
        p.drawInfo(text);
    }

    // Dendrogramma "a gomito" classico, layout right-to-left dalle foglie alla radice.
    // Le foglie sono distribuite uniformemente in verticale, i nodi interni
    // si piazzano alla x proporzionale al loro livello nell'albero.
    _drawTree(result){
        let p = this.p;
        let root = result.currentClusters[0];
        let clusterMap = new Map(result.allClusters.map((cluster) => [cluster.id, cluster]));
        let leaves = [];

        let collectLeaves = (cluster) => {
            if(!cluster.tree || cluster.tree.length === 0){
                leaves.push(cluster);
                return;
            }
            for(let childId of cluster.tree){
                let child = clusterMap.get(childId);
                if(child) collectLeaves(child);
            }
        };

        collectLeaves(root);

        let panelWidth = Math.min(420, Math.max(280, p.width * 0.36));
        let panel = {
            x: p.width - panelWidth - 18,
            y: 44,
            width: panelWidth,
            height: Math.max(260, p.height - 76)
        };

        let left = panel.x + 28;
        let right = panel.x + panel.width - 54;
        let top = panel.y + 46;
        let bottom = panel.y + panel.height - 22;
        let leafGap = leaves.length > 1 ? (bottom - top) / (leaves.length - 1) : 0;
        let rootLevel = Math.max(1, root.level || 1);
        let layout = new Map();

        for(let [i, leaf] of leaves.entries()){
            layout.set(leaf.id, { x: right, y: top + i * leafGap });
        }

        let place = (cluster) => {
            if(layout.has(cluster.id)) return layout.get(cluster.id);

            let children = cluster.tree
                .map((childId) => clusterMap.get(childId))
                .filter(Boolean);

            let childPositions = children.map((child) => place(child));
            let y = childPositions.reduce((sum, point) => sum + point.y, 0) / childPositions.length;
            let levelRatio = (cluster.level || 0) / rootLevel;
            let x = right - levelRatio * (right - left);
            let position = { x: x, y: y };

            layout.set(cluster.id, position);
            return position;
        };

        place(root);

        let ink = p.glyphColor();
        let isDark = p.isDarkTheme();
        p.ctx.save();
        p.ctx.fillStyle = p.panelBg(0.92);
        p.ctx.strokeStyle = isDark ? "rgba(148,163,184,0.4)" : "rgba(148,163,184,0.7)";
        p.ctx.lineWidth = 1;
        p.roundRect(panel.x, panel.y, panel.width, panel.height, 14);
        p.ctx.fill();
        p.ctx.stroke();

        p.ctx.fillStyle = ink;
        p.ctx.font = "800 13px Arial";
        p.ctx.fillText("HCluster hierarchy", panel.x + 16, panel.y + 24);

        for(let cluster of result.allClusters){
            if(!cluster.tree || cluster.tree.length !== 2 || !layout.has(cluster.id)) continue;

            let parent = layout.get(cluster.id);

            for(let childId of cluster.tree){
                let child = layout.get(childId);
                if(!child) continue;

                let elbowX = (parent.x + child.x) / 2;
                p.ctx.beginPath();
                p.ctx.moveTo(parent.x, parent.y);
                p.ctx.lineTo(elbowX, parent.y);
                p.ctx.lineTo(elbowX, child.y);
                p.ctx.lineTo(child.x, child.y);
                p.ctx.lineWidth = 1.2;
                p.ctx.strokeStyle = "rgba(37,99,235,0.42)";
                p.ctx.stroke();
            }
        }

        let leafFont = leaves.length > 35 ? "8px Arial" : "10px Arial";

        for(let cluster of result.allClusters){
            let position = layout.get(cluster.id);
            if(!position) continue;

            let isLeaf = !cluster.tree || cluster.tree.length === 0;
            let label = isLeaf ? `P${cluster.points[0].i + 1}` : `C${cluster.id}`;

            let accent = isDark ? "#4f8cff" : "#1769e0";
            let leafDot = isDark ? "#94a3b8" : "#334155";

            p.ctx.beginPath();
            p.ctx.arc(position.x, position.y, isLeaf ? 2.4 : 3.6, 0, 2 * Math.PI, false);
            p.ctx.fillStyle = isLeaf ? leafDot : accent;
            p.ctx.fill();

            p.ctx.fillStyle = isLeaf ? p.inkColor(0.6) : ink;
            p.ctx.font = isLeaf ? leafFont : "700 9px Arial";
            p.ctx.fillText(label, position.x + 6, position.y + 3);
        }

        p.ctx.restore();
    }
}
