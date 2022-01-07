let Automerge = require('automerge')

let docId = window.location.hash
let exists = localStorage.getItem(docId)

let observable = new Automerge.Observable()
let doc

if (exists) {
	let parsed = Uint8Array.from(Buffer.from(exists, 'base64'))
	doc = Automerge.load(parsed, { observable })
	console.log('got answers', doc.answers.length)
} else {
	doc = Automerge.from({ answers: []}, { observable })
}

let surveyContainer = document.createElement('div')
let question = document.createElement('h1')
let link = document.createElement('h3')
let answersContainer = document.createElement('ul')
let input = document.createElement('input')
let button = document.createElement('button')
button.setAttribute('type', 'submit')

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
			console.log('clicked', answer.value)
			doc = Automerge.change(doc, doc => {
				doc.answers[index].count.increment()
			})
		}
	})

	button.onclick = (ev) => {
		doc = Automerge.change(doc, (doc) => {
			if (!doc.question) doc.question = input.value
			else {
				doc.answers.push({
					value: input.value,
					count: new Automerge.Counter()
				})
			}
			input.value = null
		})
	}
}

surveyContainer.appendChild(question)
surveyContainer.appendChild(answersContainer)
surveyContainer.appendChild(link)
surveyContainer.appendChild(input)
surveyContainer.appendChild(button)
document.body.appendChild(surveyContainer)

render(doc)

observable.observe(doc, (diff, before, after, local, changes) => {
	let bytes = Automerge.save(after)
	let string = Buffer.from(bytes).toString('base64')
	console.log('saved', after.answers.length)
	localStorage.setItem(docId, string)
	render(after)
})