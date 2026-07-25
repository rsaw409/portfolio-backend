import logger from '../@rsaw409/logger.js';
import {
  getAllCertificates as getAllCertificatesFromDb,
  addCertificates as addCertificatesInDb,
  deleteCertificates as deleteCertificatesInDb,
} from './db/queries/certificate.js';
import {
  getAllEducations as getAllEducationsFromDb,
  addEducations as addEducationsInDb,
  deleteEducations as deleteEducationsInDb,
} from './db/queries/education.js';
import {
  getAllProjects as getAllProjectsFromDb,
  deleteProjects as deleteProjectsInDb,
  addProjects as addProjectsInDb,
} from './db/queries/project.js';
import {
  getAllSkills as getAllSkillsFromDb,
  addSkills as addSkillsInDb,
  deleteSkills as deleteSkillsInDb,
} from './db/queries/skill.js';
import {
  getuser as getuserFromDb,
  addOrUpdateUser as addOrUpdateUserInDB,
} from './db/queries/user.js';
import {
  getAllExperiences as getAllExperiencesFromDb,
  addExperiences as addExperiencesInDb,
  deleteExperiences as deleteExperiencesInDb,
} from './db/queries/work-experience.js';

import { Request, Response } from 'express';

import supabase from '../@rsaw409/supabase.js';
import { ErrorMessage } from '../@rsaw409/constant.js';
import {
  Certificate,
  Education,
  Project,
  Skill,
  WorkExperience,
  User,
} from '../types/portfolio.js';

const getAllCertificates = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);
    const certificates: Certificate[] = await getAllCertificatesFromDb(user_id);

    return res.status(200).send(certificates);
  } catch (error: unknown) {
    logger.error(error);
    let message = 'An unknown error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const getAllProjects = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);
    const projects: Project[] = await getAllProjectsFromDb(user_id);

    return res.status(200).send(projects);
  } catch (error: unknown) {
    logger.error(error);
    let message = 'An unknown error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const getAllEducations = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);
    const educations: Education[] = await getAllEducationsFromDb(user_id);

    return res.status(200).send(educations);
  } catch (error: unknown) {
    logger.error(error);
    let message = 'An unknown error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const getAllExperiences = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);
    const experiences: WorkExperience[] =
      await getAllExperiencesFromDb(user_id);

    return res.status(200).send(experiences);
  } catch (error: unknown) {
    logger.error(error);
    let message = 'An unknown error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const getAllSkills = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);
    const skills: Skill[] = await getAllSkillsFromDb(user_id);

    return res.status(200).send(skills);
  } catch (error: unknown) {
    logger.error(error);
    let message = 'An unknown error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const getuser = async (req: Request, res: Response) => {
  try {
    const user_email: string = String(req.query.user_email);
    const name: string | undefined = req.headers.name as unknown as
      | string
      | undefined;
    const user: User = await getuserFromDb(user_email, name);
    if (user === null) {
      throw new Error('user not found');
    }
    return res.status(200).send(user);
  } catch (error: unknown) {
    logger.error(error);
    let message = 'An unknown error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const addProjects = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await addProjectsInDb({ ...req.body, user_id });

    return res.status(200).send({ message: result });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const deleteProjects = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await deleteProjectsInDb({ ...req.body, user_id });

    return res.status(200).send({ message: result });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const addSkills = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await addSkillsInDb({ ...req.body, user_id });

    return res.status(200).send(result);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const deleteSkills = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await deleteSkillsInDb({ ...req.body, user_id });

    return res.status(200).send({ message: result });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const addCertificates = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await addCertificatesInDb({ ...req.body, user_id });

    return res.status(200).send(result);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const deleteCertificates = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await deleteCertificatesInDb({ ...req.body, user_id });

    return res.status(200).send({ message: result });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const addEducations = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await addEducationsInDb({ ...req.body, user_id });

    return res.status(200).send(result);
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const deleteEducations = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await deleteEducationsInDb({ ...req.body, user_id });

    return res.status(200).send({ message: result });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const addExperiences = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await addExperiencesInDb({ ...req.body, user_id });

    return res.status(200).send({ message: result });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const deleteExperiences = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    const result = await deleteExperiencesInDb({ ...req.body, user_id });

    return res.status(200).send({ message: result });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

const addOrUpdateUser = async (req: Request, res: Response) => {
  try {
    const user_id: number = Number(req.query.user_id);

    let timestamp = Date.now();
    let profile_url = null;
    if (req.file) {
      profile_url = `https://cywiacstqjeecqodaozz.supabase.co/storage/v1/object/public/portfolio_images/${req.body.user_email}/${user_id}_${timestamp}`;
    }

    const user: User = {
      name: req.body.name,
      user_email: req.body.user_email,
      about: req.body.about,
      profile_url: profile_url!,
      social_links: {
        github_url: req.body.github_url,
        linkedin_url: req.body.linkedin_url,
        blog_url: req.body.blog_url,
        twitter_url: req.body.twitter_url,
        stackoverflow_url: req.body.stackoverflow_url,
      },
    };

    const result = await addOrUpdateUserInDB(user, user_id);

    if (req.file) {
      await supabase.deleteFileFromSupabase(req.body.user_email);
      await supabase.uploadFileToSupabse(
        `${req.body.user_email}/${user_id}_${timestamp}`,
        req.file
      );
    }

    return res.status(200).send({ message: result });
  } catch (error: unknown) {
    logger.error(error);
    let message = ErrorMessage.Unknown;
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).send({ message: message });
  }
};

export {
  getAllCertificates,
  getAllProjects,
  getAllEducations,
  getAllExperiences,
  getAllSkills,
  getuser,

  // Add Controllers
  addProjects,
  addSkills,
  addCertificates,
  addEducations,
  addExperiences,
  addOrUpdateUser,

  // Delete Controllers
  deleteProjects,
  deleteSkills,
  deleteCertificates,
  deleteEducations,
  deleteExperiences,
};
