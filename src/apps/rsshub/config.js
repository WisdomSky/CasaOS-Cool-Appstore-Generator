export default {
    tag: {
        pattern: /^\d{4}-\d{1,2}-\d{1,2}$/
    },
    services: {
        browserless: {
            tag: {
                pattern: /^\d+(?:\.\d+(?:\.\d+)?)?-puppeteer-\d+(?:\.\d+(?:\.\d+)?)?$/
            }
        },
        redis: {
            tag: {
                pattern: /^(\d+\.\d+(\.\d)?)-alpine$/
            }
        }
    }
}