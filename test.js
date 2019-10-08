const tf = require('@tensorflow/tfjs')
// const d = require('./deck')

// const deck = d.makeDeck()

// const card = deck[0].oneHot
// const addedTrump = card.concat(tf.tensor1d([1]))
// const pad = addedTrump.pad([[0,3]])

// const cards = deck.slice(0, 4)
// const addT = cards.map(c => {
//     return c.oneHot.concat(tf.tensor1d([1])).arraySync()
// })

// const tens = tf.tensor(addT)
// const padded = tens.pad([[0, 40 - tens.shape[0]], [0,0]])

// padded.print()
// console.log(padded.shape)

const x = tf.tensor([
    0.09830176085233688,
    0.08010498434305191,
    0.17865410447120667,
    0.16565828025341034,
    0.26919618248939514,
    0.08920321613550186,
    0.03941837698221207,
    0.012338333763182163,
    0.0611133836209774,
    0.006011391524225473 ])

const y = x.argMax().dataSync()[0]

x.print()
console.log(y)
