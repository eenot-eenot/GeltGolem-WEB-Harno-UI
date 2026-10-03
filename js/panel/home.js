document.addEventListener('DOMContentLoaded', () => {
    const langChose = document.querySelector('#home .page-header-btns .btnsList')

    langChose.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            renderLang(btn.textContent.toLowerCase())
        })
    })
})

function renderLang(lang) {
    document.querySelectorAll('#langsModules .langModule').forEach(module => {
        module.classList.remove('active')

        if (module.dataset.lang === lang) module.classList.add('active')
    })

    document.querySelector('#home .page-header h1').textContent = lang[0].toUpperCase() + lang.slice(1)
    document.querySelector('#home .page-header h3').textContent = "0 из 5 модулей пройдено"
}