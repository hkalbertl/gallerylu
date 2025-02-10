export default class GalleryLu {

  /**
   * Get the error message from string or Error object.
   * @param ex Error message or error object.
   * @returns Just the string error message.
   */
  static getErrorMessage(ex: unknown): string {
    if ('string' === typeof ex) {
      return ex;
    } else if (ex instanceof Error) {
      return ex.message;
    }
    return `${ex}`;
  }
}
