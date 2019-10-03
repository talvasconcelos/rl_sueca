const tf = require('@tensorflow/tfjs')
const d = require('./deck')

const deck = d.makeDeck()

const card = deck[0].oneHot
const addedTrump = card.concat(tf.tensor1d([1]))
const pad = addedTrump.pad([[0,3]])

const cards = deck.slice(0, 4)
const addT = cards.map(c => {
    return c.oneHot.concat(tf.tensor1d([1])).arraySync()
})

const tens = tf.tensor(addT)
const padded = tens.pad([[0, 40 - tens.shape[0]], [0,0]])

padded.print()
console.log(padded.shape)