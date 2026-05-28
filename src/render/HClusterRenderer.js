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

        // Il dendrogramma cresce sul canvas insieme all'algoritmo: viene disegnato
        // a ogni step come anteprima della foresta corrente -> albero finale.
        // Niente piu' gating sul collapse: la progressione e' parte del racconto.
        if(result.allClusters && result.initClusters > 1){
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

    // Dendrogramma multi-root che cresce a ogni step. Quando la foresta ha
    // ancora N alberi, ciascuno occupa una fetta verticale del pannello;
    // man mano che i merge collassano i sotto-alberi diventano un unico tree.
    _drawTree(result){
        let p = this.p;
        let roots = result.currentClusters || [];
        if(roots.length === 0) return;

        let clusterMap = new Map(result.allClusters.map((cluster) => [cluster.id, cluster]));

        let collectLeaves = (cluster, into) => {
            if(!cluster.tree || cluster.tree.length === 0){
                into.push(cluster);
                return;
            }
            for(let childId of cluster.tree){
                let child = clusterMap.get(childId);
                if(child) collectLeaves(child, into);
            }
        };

        let rootBundles = roots.map((root) => {
            let leaves = [];
            collectLeaves(root, leaves);
            return { root: root, leaves: leaves };
        });

        let totalLeaves = rootBundles.reduce((sum, bundle) => sum + bundle.leaves.length, 0);
        if(totalLeaves === 0) return;

        // Pannello compatto in alto a destra: lascia respiro ai bubble dei cluster.
        let panelWidth = Math.min(420, Math.max(300, p.width * 0.34));
        let panelHeight = Math.max(260, Math.min(p.height - 76, 80 + totalLeaves * 12));
        let panel = {
            x: p.width - panelWidth - 18,
            y: 44,
            width: panelWidth,
            height: panelHeight
        };

        let left = panel.x + 28;
        let right = panel.x + panel.width - 54;
        let top = panel.y + 46;
        let bottom = panel.y + panel.height - 22;
        let leafGap = totalLeaves > 1 ? (bottom - top) / (totalLeaves - 1) : 0;

        // Scala x per livello: piu' avanti siamo, piu' nodi profondi esistono.
        // Usiamo il max livello osservato nella foresta corrente.
        let maxLevel = Math.max(1, ...result.allClusters.map((c) => c.level || 0));
        let layout = new Map();
        let leafIndex = 0;

        for(let bundle of rootBundles){
            for(let leaf of bundle.leaves){
                layout.set(leaf.id, { x: right, y: top + leafIndex * leafGap });
                leafIndex++;
            }
        }

        let place = (cluster) => {
            if(layout.has(cluster.id)) return layout.get(cluster.id);

            let children = (cluster.tree || [])
                .map((childId) => clusterMap.get(childId))
                .filter(Boolean);

            if(children.length === 0){
                return layout.get(cluster.id) || { x: right, y: top };
            }

            let childPositions = children.map((child) => place(child));
            let y = childPositions.reduce((sum, point) => sum + point.y, 0) / childPositions.length;
            let levelRatio = (cluster.level || 0) / maxLevel;
            let x = right - levelRatio * (right - left);
            let position = { x: x, y: y };

            layout.set(cluster.id, position);
            return position;
        };

        for(let bundle of rootBundles){
            place(bundle.root);
        }

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
        let progress = roots.length === 1
            ? "complete"
            : `${roots.length} sub-trees · merge ${result.iterations || 0}`;
        p.ctx.fillText(`HCluster hierarchy — ${progress}`, panel.x + 16, panel.y + 24);

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

        // Marker per l'ultimo merge appena fatto: highlight della congiunzione
        // cosi' l'utente vede esattamente quale pair e' stato unito allo step.
        if(result.merged && result.merged.length === 2){
            let last = result.allClusters[result.allClusters.length - 1];
            if(last && layout.has(last.id)){
                let parent = layout.get(last.id);
                p.ctx.beginPath();
                p.ctx.arc(parent.x, parent.y, 5, 0, 2 * Math.PI, false);
                p.ctx.fillStyle = isDark ? "#facc15" : "#ca8a04";
                p.ctx.fill();
            }
        }

        let leafFont = totalLeaves > 35 ? "8px Arial" : "10px Arial";

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
