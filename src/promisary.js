// Provides a tangible promise that can be manipulated from the outside.

const promisary = () => {
  const ret = {
    accept: function() {
      ret.result = arguments;
    },
    reject: function() {
      ret.error = arguments;
    },
    promise: new Promise((accept, reject) => {
      ret.accept = (result) => {
        ret.result = result;
        accept(result);
      };
      ret.reject = (error) => {
        ret.error = error;
        reject(error);
      };
      if (ret.result) accept.apply(this, ret.result);
      if (ret.error) reject.apply(this, ret.error);
    })
  };
  return ret;
}

module.exports = promisary;
