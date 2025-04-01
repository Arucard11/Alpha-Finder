const {getAllRunners,updateRunner} = require('../DB/querys')


getAllRunners().then((runners) => {
    runners.forEach((runner) => {
        
        updateRunner(runner.id,"checked",false).catch((err) => console.error(err));
    });
})