export default {
    tag: {
        pattern: /^version-\d+\.\d+\.\d+$/
    },
    services: {
        db: {
            tag: {
                pattern: /^11\.8(\.\d+)?$/
            }
        },
        cron: {
            tag: {
                pattern: /^latest$/
            }
        }
    }
}
