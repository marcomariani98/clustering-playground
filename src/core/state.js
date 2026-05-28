"use strict";

// Tutto lo stato vivo della playground: i punti sul canvas, l'ultimo risultato,
// gli step preparati, dove siamo nello scrubbing, il timer del Play.
// Tenerlo in una classe rende ovvio cosa cambia quando: prima erano let sparsi.

class AppState{
    constructor(){
        this.mode = "kmeans";
        this.data = [];
        this.currentResult = null;
        this.currentSteps = [];
        this.stepIndex = 0;
        this.metricsReady = false;
        this.autoTimer = null;
        this.autoDelay = 0;
        this.safeMode = true;
    }

    setMode(mode){
        this.mode = mode;
    }

    addPoint(point){
        this.data.push(point);
    }

    addPoints(points){
        this.data = this.data.concat(points);
    }

    resetPoints(){
        this.data = [];
    }

    setResult(result){
        this.currentResult = result;
        this.metricsReady = true;
    }

    setSteps(steps){
        this.currentSteps = steps || [];
        this.stepIndex = 0;
    }

    advanceStep(){
        if(this.stepIndex >= this.currentSteps.length){
            return null;
        }

        this.currentResult = this.currentSteps[this.stepIndex];
        this.stepIndex++;
        this.metricsReady = this.stepIndex >= this.currentSteps.length;
        return this.currentResult;
    }

    hasSteps(){
        return this.currentSteps && this.currentSteps.length > 0;
    }

    hasMoreSteps(){
        return this.stepIndex < this.currentSteps.length;
    }

    rewind(){
        this.stepIndex = 0;
        this.currentResult = null;
        this.metricsReady = false;
    }

    clearResult(){
        this.stopTimer();
        this.currentResult = null;
        this.currentSteps = [];
        this.stepIndex = 0;
        this.metricsReady = false;
    }

    startTimer(delay, tick){
        if(this.autoTimer){
            return;
        }
        this.autoDelay = delay;
        this.autoTimer = setInterval(tick, delay);
    }

    stopTimer(){
        if(this.autoTimer){
            clearInterval(this.autoTimer);
            this.autoTimer = null;
        }
    }

    isPlaying(){
        return this.autoTimer !== null;
    }
}
