export const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

export const getActorInfo = (event) => {
  return {
    name: event.actor.display_login,
    urlProfile: `https://github.com/${event.actor.login}`,
  };
};

export const getRepositoryInfo = (event) => {
  return {
    name: event.repo.name.split("/")[1],
    url: `https://github.com/${event.repo.name}`,
  };
};
