window.eelib = {
    nav: {
        downStyle: 'floating',
        leftBtn: 'none',
        maxDown: 5,
        noName: true,
    },
};

window.eelib.pages = [
    {
        id: 'home',
        title: 'Главная',
        icon: 'img/ui/home.svg',
        subcategories: [
            "Javascript",
            "Pascal",
            "C#",
            "C++",
            "Python",
        ],
        subpages: [
            "langmodule",
        ],
        subpagesmode: 'modal',
    },
    {
        id: 'league',
        title: 'Лига',
        icon: 'img/nav/league.png',
    },
    {
        id: 'leaderboard',
        title: 'Рейтинг',
        icon: 'img/nav/leaderboard.svg',
    },
    {
        id: 'achivements',
        title: 'Достижения',
        icon: 'img/nav/achivements.png',
    },
    {
        id: 'profile',
        title: 'Профиль',
        icon: 'img/ui/user.svg',
    },
    {
        id: 'langmodule',
        title: 'langmodule',
        icon: 'img/ui/notebook.svg',
        noLeft: true,
        noBottom: true,
        leftBtn: 'back',
    },
    {
        id: 'lesson',
        title: 'langmodule',
        icon: 'img/ui/notebook.svg',
        noLeft: true,
        noBottom: true,
        noNav: true,
        leftBtn: 'back',
    },
    {
        id: 'splash',
        title: 'splashscreen',
        icon: 'img/ui/home.svg',
        noLeft: true,
        noBottom: true,
        noNav: true,
        active: true,
    },
    {
        id: 'welcome',
        title: 'welcome',
        icon: 'img/ui/home.svg',
        noLeft: true,
        noBottom: true,
        noNav: true,
    },
    {
        id: 'registration',
        title: 'Создай профиль',
        description: 'Как тебя звать? Это будет видно<br>в рейтинге и таблице лидеров.',
        icon: 'img/ui/user.svg',
        iconHead: 'img/ui/user.svg',
        noLeft: true,
        noBottom: true,
        noNav: true,
    },
    {
        id: 'about',
        title: 'About',
        icon: 'img/ui/user.svg',
        leftBtn: 'back',
        subpages: [
            'seek',
        ],
        subpagesmode: 'modal',
        noBottom: true,
    },
    {
        id: 'settings',
        title: 'Настройки',
        icon: 'img/ui/settings.svg',
        noBottom: true,
    },
]

window.eelib.translations = {}

window.eelib.settingsConfig = {
    storageKey: 'appSettings',
    defaultSettings: {
        weather: {
            town: '',
            location: [0, 0],
            unit: "C",
            background: false,
            pageBackground: false,
            },
        clock: {
            clockFormat: "24",
            showSeconds: false,
            showDate: true,
            dateFormat: "DDMMYYYY",
            timeZone: "local",
            showDayOfWeek: true,
            leadingZero: true,
            amPm: false,
            showYear: true,
            monthAsText: false,
            dateSeparator: "/",
            jucheCalendar: false,
        },
        main: {
            theme: "dark",
        },
    },
    schema: {
        clock: {
            title: "Clock",
            items: [
                {
                    type: "select",
                    key: "clockFormat",
                    label: "Clock Format",
                    options: { "12": "12-hour", "24": "24-hour" }
                },
                { type: "toggle", key: "showSeconds", label: "Show Seconds" },
                { type: "toggle", key: "showDate", label: "Show Date" }
            ]
        },
        weather: {
            title: "Weather",
            items: [
                { type: "toggle", key: "background", label: "Weather Background" },
                { type: "toggle", key: "pageBackground", label: "Page Background" }
            ]
        },
        main: {
            title: "Main",
            items: [
                {
                    type: "select",
                    key: "theme",
                    label: "Theme",
                    options: { "dark": "Dark", "light": "Light", "oled": "Black OLED" }
                },
            ]
        },
    },
    onChange: (settings) => {
        // Вызывается при любом изменении настроек
        if (typeof updateTimeDisplay === 'function') {
        updateTimeDisplay();
        }
    }
}