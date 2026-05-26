"use strict";

// Generatori dei dataset. Tre parametri condivisi:
//   - count: quanti punti
//   - spread: scala della forma
//   - noisePercent: quanto i punti si allontanano dalla distribuzione ideale

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
        let center = {
            x: randomBetween(margin,width - margin),
            y: randomBetween(margin,height - margin)
        };
        let clusterSize = Math.floor(totalPoints / clusterCount);

        if(i < totalPoints % clusterCount){
            clusterSize++;
        }

        for(let j = 0;j < clusterSize;j++){
            // sqrt(random) per distribuire uniformemente sull'area del cerchio
            // (random() da solo concentra troppo i punti vicino al centro).
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

    // Prima luna: arco superiore
    for(let i = 0;i < firstMoonCount;i++){
        let t = Math.PI * (i / Math.max(1,firstMoonCount - 1));
        let x = centerX + Math.cos(t) * radius + randomBetween(-noise,noise);
        let y = centerY - Math.sin(t) * radius + randomBetween(-noise,noise);
        points.push({x:clamp(x,8,width - 8),y:clamp(y,8,height - 8)});
    }

    // Seconda luna: stesso arco specchiato e shiftato
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

    // Due bracci opposti: dataset rognoso per K-Means, perfetto per Spectral.
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

