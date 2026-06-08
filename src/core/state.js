"use strict";

// Central session state for the clustering playground. Holds all mutable data:
// - The dataset (points) and the current clustering mode
// - The current result and step history for scrubbing through algorithm execution
// - Playback state (timer, playback flag)
// - Safe-mode toggle and GMM model history
// Using a class makes it obvious what changes during the session and centralizes
// all stateful logic in one place (vs. scattered let globals).

class AppState{
    constructor(){
        this.mode = "kmeans";           // Current algorithm mode (kmeans, dbscan, etc.)
        this.data = [];                 // Array of {x, y} points on the canvas
        this.currentResult = null;      // Last clustering result or current step snapshot
        this.currentSteps = [];         // Array of step snapshots from algorithm execution
        this.stepIndex = 0;             // Current position in the step array
        this.metricsReady = false;      // True if the current result is a final result (not a step)
        this.autoTimer = null;          // setInterval ID for Play mode
        this.autoDelay = 0;             // Current animation delay in ms
        this.safeMode = true;           // If true, enforce per-algorithm point limits
        // GMM run history for the current dataset. Feeds the AIC/BIC comparison table.
        // Keyed by a hash of all point coordinates so runs are matched to datasets.
        this.gmmModelComparisons = [];
        this.gmmComparisonDatasetKey = "";
    }

    // Change the active clustering algorithm.
    setMode(mode){
        this.mode = mode;
    }

    // Add a single point to the dataset.
    addPoint(point){
        this.data.push(point);
    }

    // Add multiple points to the dataset.
    addPoints(points){
        this.data = this.data.concat(points);
    }

    // Clear all points from the dataset.
    resetPoints(){
        this.data = [];
    }

    // Set the final result and mark metrics as ready. Used by Execute mode.
    setResult(result){
        this.currentResult = result;
        this.metricsReady = true;
    }

    // Set the step array and reset the step pointer to 0.
    // Called after run() returns; subsequent calls to advanceStep() will step through.
    setSteps(steps){
        this.currentSteps = steps || [];
        this.stepIndex = 0;
    }

    // Advance to the next step snapshot. Returns the snapshot or null if at the end.
    // Cost: O(1), no algorithm recalculation. stepIndex points to the NEXT step to show,
    // so currentResult is always currentSteps[stepIndex - 1].
    advanceStep(){
        if(this.stepIndex >= this.currentSteps.length){
            return null;
        }

        this.currentResult = this.currentSteps[this.stepIndex];
        this.stepIndex++;
        this.metricsReady = this.stepIndex >= this.currentSteps.length;
        return this.currentResult;
    }

    // Mirror of advanceStep: move back one step. Cost: O(1), no extra memory.
    // All steps are already in currentSteps; this only moves the index backward.
    // Handles the edge case after Execute: stepIndex is 0, so we enter from the end
    // of the timeline to avoid showing the result as a "previous step".
    retreatStep(){
        if(!this.hasSteps()){
            return null;
        }
        // After Execute, we're "at the end" with stepIndex 0. Enter the timeline from the end.
        if(this.stepIndex === 0){
            this.stepIndex = this.currentSteps.length;
        }
        if(this.stepIndex <= 1){
            return null;
        }
        this.stepIndex--;
        this.currentResult = this.currentSteps[this.stepIndex - 1];
        this.metricsReady = this.stepIndex >= this.currentSteps.length;
        return this.currentResult;
    }

    // Check if there are any steps loaded (i.e., the algorithm has been run in Step/Play mode).
    hasSteps(){
        return this.currentSteps && this.currentSteps.length > 0;
    }

    // Check if there are more steps to advance through from the current position.
    hasMoreSteps(){
        return this.stepIndex < this.currentSteps.length;
    }

    // Rewind to the beginning of the step array without clearing it.
    // Useful for replaying the animation after reaching the end.
    rewind(){
        this.stepIndex = 0;
        this.currentResult = null;
        this.metricsReady = false;
    }

    // Clear the result and step history. Stop any active playback timer.
    // Called when the dataset or algorithm parameters change.
    clearResult(){
        this.stopTimer();
        this.currentResult = null;
        this.currentSteps = [];
        this.stepIndex = 0;
        this.metricsReady = false;
    }

    // Start the automatic playback timer. Call the tick callback every delay ms.
    startTimer(delay, tick){
        if(this.autoTimer){
            return;
        }
        this.autoDelay = delay;
        this.autoTimer = setInterval(tick, delay);
    }

    // Stop the playback timer without clearing steps or results.
    stopTimer(){
        if(this.autoTimer){
            clearInterval(this.autoTimer);
            this.autoTimer = null;
        }
    }

    // Check if the Play timer is currently running.
    isPlaying(){
        return this.autoTimer !== null;
    }
}
