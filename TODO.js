injector.provideGlobal('a', (x) => x * 2);

injector.inject(['funA', function(a) {
  const x = [1,2,3,4,5,6,7,8,9,10];

  Promise.all(x.map(a)).then((arr) => {
    console.log(arr);
  })
}])

// Demontrate this map process being distributed.
