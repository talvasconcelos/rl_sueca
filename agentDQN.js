const d = require('./deck')
const tf = require('@tensorflow/tfjs')

// require('@tensorflow/tfjs-node')

class Agent {
    constructor(stateSize, modelName = 'DQN', gamma = 0.95, epsilon = 1.0, epsMin = 0.01, epsDecay = 0.95, lr = 0.001) {
        this.stateSize = stateSize
        this.actionSize = 10
        this.batchSize = 32
        this.memory = []
        this.maxMem = 10000
        this.state = null
        this.nextState = null
        this.reward = null
        this.modelName = modelName
        this.deck = d.makeDeck()
        this.suits = this.encode(this.deck.suits)
        this.nums = this.encode(this.deck.nums)

        this.gamma = gamma
        this.epsilon = epsilon
        this.epsilonMin = epsMin
        this.epsilonDecay = epsDecay

        this.lr = lr

        this.model = this.model()
    }

    model() {
        const model = tf.sequential()
        model.add(tf.layers.dense({
            units: 64,
            inputDim: this.stateSize,
            activation: 'relu'
        }))
        // model.add(tf.layers.dense({units: 32, activation: 'elu'}))
        model.add(tf.layers.dense({
            units: this.actionSize,
            activation: 'softmax'
        }))

        model.compile({
            // optimizer: tf.train.adam({learningRate: this.lr}),
            optimizer: tf.train.adam(),
            loss: 'meanSquaredError',
            metrics: ['accuracy']
        })
        model.summary()

        return model
    }

    encode(arr) {
        const idx = arr.map((_, i) => i)
        const enc = tf.oneHot(idx, arr.length)
        // enc.print()
        return enc.arraySync()
    }

    addTrumpConcat(trump, tensor) {
        return new Promise(resolve => {
            // console.log(name, tensor)
            if (tensor.length === 0) {
                return resolve(tf.zeros([40, 15]).arraySync())
            }
            const x = tensor.map(c => {
                const isTrump = c.suit === trump
                return tf.concat([
                    this.suits[c.idx[0]],
                    this.nums[c.idx[1]],
                    isTrump ? tf.tensor1d([1]) : tf.tensor1d([0])
                ]).arraySync()
            })
            const trumpedTensor = tf.tensor(x)
            const out = trumpedTensor.pad([
                [0, 40 - trumpedTensor.shape[0]],
                [0, 0]
            ]).arraySync()
            // console.debug('concat')
            // console.log(out)
            return resolve(out)
        })
    }

    async _getState(state) {
        const {
            trump,
            hand,
            table,
            played
        } = state
        const stateHand = await this.addTrumpConcat(trump, hand)
        const stateTable = await this.addTrumpConcat(trump, table)
        const statePlayed = await this.addTrumpConcat(trump, played)
        // await Promise.all([stateHand, stateTable, statePlayed])
        // console.debug('getState')
        return [stateHand, stateTable, statePlayed]

        // return [stateHand, stateTable, statePlayed]


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
        const random = Math.floor(Math.random() * hand)
        if (Math.random() <= this.epsilon) {
            return random
        }
        const input = state.reshape([1, this.stateSize])
        const prediction = await this.model.predict(input)
        const pred = prediction.argMax(1).dataSync()[0]
        // prediction.print()
        // console.log('act', prediction.argMax(1).dataSync()[0])
        // console.debug('takeAction', pred, hand, random)
        const action = pred >= hand ? random : pred
        return [action, null, null]
    }

    async _takeAction(state, hand) {
        // console.debug('takeAction')            
        const random = Math.floor(Math.random() * hand)
        if (Math.random() <= this.epsilon) {
            // console.log('Random AI')
            return random
        }
        // console.log('Take action AI')
        const stateInput = await tf.concat(state).reshape([1, this.stateSize])
        const p = await this.model.predict(stateInput)
        // stateInput.print()
        // p.print()
        // console.log(p.argMax().dataSync()[0])
        // console.log(stateInput.shape)
        // console.log(p.argMax().dataSync()[0])
        const pred = p.argMax().dataSync()[0]
        // console.debug(hand, p.dataSync())
        const action = pred >= hand ? random : pred
        stateInput.dispose()
        p.dispose()
        console.debug('Action:', action, pred)
        return action
    }

    async fastExpRep(){

    }

    async expReplay() {
        console.debug('Training...')
        const minibatch = [...this.memory].sort(() => .5 - Math.random()).slice(0, this.batchSize)
        // console.debug(minibatch)
        for (let i = 0; i < minibatch.length - 1; i++) {
            let [state, action, reward, next_state, done] = minibatch[i]
            // console.debug(state, next_state)
            // console.log(minibatch[i])
            state = await state.reshape([1, this.stateSize])
            next_state = await next_state.reshape([1, this.stateSize])
            let target = reward
            // console.log(next_state.shape, state.shape)
            if (!done) {
                let predictNext = await this.model.predict(next_state)
                // let y = predictNext.argMax().dataSync()
                target = reward + this.gamma * predictNext.argMax(1).dataSync()[0]
                // console.log('y', y)
            }

            let target_f = await this.model.predict(state).dataSync()
            target_f[action] = target
            // target_f = await tf.tensor1d(target_f)
            // target_f.print()
            // console.log(target_f.shape)
            // target_f.print()
            target_f = tf.tensor2d(target_f, [1, this.actionSize])//.reshape([1,3])
            await this.model.fit(state, target_f, {
                epochs: 1,
                verbose: 1,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        // console.log('Logloss:', logs.loss)
                        process.stdout.write(`${logs.loss} ${logs.acc}                  \r`)
                    }
                }
            })

            await state.dispose()
            await next_state.dispose()
            await target_f.dispose()
        }
        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay
        }
        console.debug('Training... stop!')
        return
    }
}

module.exports = Agent