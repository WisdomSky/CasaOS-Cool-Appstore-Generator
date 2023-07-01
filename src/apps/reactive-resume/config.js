export default {
    tag: {
        pattern: /^v\d+\.\d+\.\d+$/
    },
    services: {
        db: {
            tag: {
                pattern: /^(\d+(\.\d+(\.\d)?)?)$/
            }
        }
    }
}