export default {
    tag: {
        pattern: /^latest$/
    },
    services: {
        db: {
            tag: {
                pattern: /^(\d+(\.\d+(\.\d)?)?)$/
            }
        }
    }
}