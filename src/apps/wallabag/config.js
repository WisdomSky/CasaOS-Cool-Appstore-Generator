export default {
    tag: {
        pattern: /^\d+(\.\d+(\.\d+)?)?$/
    },
    services: {
        db: {
            tag: {
                pattern: /^10\.11(\.\d+)?$/
            }
        },
        redis: {
            tag: {
                pattern: /^7\.4(\.\d+)?-alpine$/
            }
        }
    }
}
