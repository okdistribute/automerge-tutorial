let Automerge = require('automerge')

let docId = window.location.hash
let channel = new BroadcastChannel(docId)

// Initialize Document
let doc
let exists = localStorage.getItem(docId)
let observable = new Automerge.Observable()

if (exists) {
	let parsed = Uint8Array.from(Buffer.from(exists, 'base64'))
	doc = Automerge.load(parsed, { observable })
} else {
	doc = Automerge.init({ observable })
	doc = Automerge.change(doc, doc => {
		doc.answers = []
	})
	save(doc)
}

// DOM elements
let surveyContainer = document.createElement('div')
let question = document.createElement('h1')
let link = document.createElement('h3')
let answersContainer = document.createElement('ul')
let input = document.createElement('input')
let button = document.createElement('button')
button.setAttribute('type', 'submit')

function clickAnswer (doc, index) {
	return Automerge.change(doc, doc => {
		doc.answers[index].count.increment()
	})
}

function addAnswer (doc, value) {
	return Automerge.change(doc, (doc) => {
		if (!doc.question) doc.question = value
		else {
			doc.answers.push({
				value: input.value,
				count: new Automerge.Counter()
			})
		}
	})
}

surveyContainer.appendChild(question)
surveyContainer.appendChild(answersContainer)
surveyContainer.appendChild(link)
surveyContainer.appendChild(input)
surveyContainer.appendChild(button)
document.body.appendChild(surveyContainer)

render(doc)

observable.observe(doc, (diff, before, after, local, changes) => {
	render(after)
	save(after)
	if (local) broadcastChanges(changes)
})

function save (doc) {
	let bytes = Automerge.save(doc)
	let string = Buffer.from(bytes).toString('base64')
	localStorage.setItem(docId, string)
}

function render (doc) {
	question.innerHTML = doc.question ? doc.question : 'New Survey'
	input.setAttribute('type', 'text')
	button.innerText = doc.question ? 'Add Answer': 'Create Question' 

	doc.answers.forEach((answer, index) => {
		let objId = Automerge.getObjectId(answer)
		let answerEl = document.getElementById(objId) 
		if (!answerEl) {
			answerEl = document.createElement('li')
			answerEl.id = objId
			answersContainer.appendChild(answerEl)
		}
		answerEl.innerHTML = `${answer.value} ${answer.count}`
		answerEl.onclick = (ev) => {
			doc = clickAnswer(doc, index)
		}
	})

	button.onclick = (ev) => {
		doc = addAnswer(doc, input.value)
		input.value = null
	}
}

channel.onmessage = function (ev) {
	let payload = ev.data
	if (payload.actorId === Automerge.getActorId(doc)) return // this is from the same tab

	let [newDoc, patch] = Automerge.applyChanges(doc, payload.changes)
	doc = newDoc
	save(newDoc)
}

function broadcastChanges (changes) {
	let actorId = Automerge.getActorId(doc)
	channel.postMessage({
		actorId,
		changes
	})
}