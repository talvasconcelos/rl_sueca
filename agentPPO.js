const d = require('./deck')
const tf = require('@tensorflow/tfjs')

// require('@tensorflow/tfjs-node')

const LOSS_CLIPPING = 0.2
const EPOCHS = 10
const NOISE = 1

const GAMMA = 0.99

const BATCH_SIZE = 64
const NUM_ACTIONS = 10
const NUM_STATE = 44
const BUFFER_SIZE = 256

const ENTROPY_LOSS = 1e-3
const LR = 1e-4

const DUMMY_ACTION = tf.zeros([4, 11])
const DUMMY_VALUE = tf.zeros([1, 1])

const proximalPolicyOptimization = (advantage, oldPrediction) => {
    const loss = (yTrue, yPred) => {
        const prob = yTrue = yPred
        const oldProb = yTrue * oldPrediction
        const r = prob / (oldProb + 1e-10)
        return -tf.mean(tf.minimum(r * advantage, tf.clipByValue(r, 1 - LOSS_CLIPPING, 1 + LOSS_CLIPPING) * advantage) + ENTROPY_LOSS * -(prob * tf.log(prob + 1e-10)))
    }
    return loss
}

class AgentPPO{
    constructor(){
        this.critic = this.buildCritic()
        this.actor = this.buildActor()
        this.batchSize = BATCH_SIZE
        this.memory = []
        this.maxMem = 1000
        this.buffer = BUFFER_SIZE
        this.val = false
    }
    
    buildActor(){
        const stateInput = tf.input({shape: [NUM_STATE]})
        const advantage = tf.input({shape: [1]})
        const oldPrediction = tf.input({shape: [NUM_ACTIONS]})

        const dense1 = tf.layers.dense({units: 64, activation: 'tanh'}).apply(stateInput)

        const outActions = tf.layers.dense({units: NUM_ACTIONS, activation: 'softmax'}).apply(dense1)

        const model = tf.model({
            inputs: [stateInput, advantage, oldPrediction], 
            outputs: outActions
        })

        model.compile({
            optimizer: tf.train.adam({learningRate: LR}),
            loss: proximalPolicyOptimization(advantage, oldPrediction)
        })

        model.summary()

        return model
    }

    buildCritic(){
        const stateInput = tf.input({shape: [NUM_STATE]})

        const dense1 = tf.layers.dense({units: 64, activation: 'tanh'}).apply(stateInput)

        const outValue = tf.layers.dense({units: 1}).apply(dense1)

        const model = tf.model({inputs: stateInput, outputs: outValue})
        model.compile({
            optimizer: tf.train.adam({learningRate: LR}),
            loss: 'meanSquaredError'
        })

        model.summary()

        return model
    }

    async getState(data){
        const {
            trump,
            hand,
            table,
            played
        } = data
        const state = tf.buffer([4, 11])
        const trumpIdx = this.deck.suits.indexOf(trump)
        state.set(1, trumpIdx, 10)
        // console.debug(isTrump)
        await hand.map(c => {
            state.set(1, c.idx[0], c.idx[1])
        })
        await played.map(c => {
            state.set(-1, c.idx[0], c.idx[1])
        })
        await table.map(c => {
            state.set(0.5, c.idx[0], c.idx[1])
        })
        // state.toTensor().print()
        return state.toTensor()
    }

    async takeAction(state, hand){
        const inputState = state.reshape([1, NUM_STATE])
        const p = this.actor.predict([inputState, DUMMY_VALUE, DUMMY_ACTION])
        const action = tf.argMax(1).dataSync()[0]
        const actionMatrix = tf.zeros([NUM_ACTIONS])
        actionMatrix[action] = 1
        return [action, actionMatrix, p]
    }

    async expReplay(){
        console.debug('Training...')
        const minibatch = this.memory.slice(-this.buffer)
        const obs = []
        const action = []
        const pred = []
        const reward = []
        for (let i = 0; i < minibatch.length; i++) {
            let [state, action, reward, next_state, done] = minibatch[i]
            const oldPrediction = action[2]
            const predValues = this.critic.predict(state)
        }
    }
}

module.exports = AgentPPO